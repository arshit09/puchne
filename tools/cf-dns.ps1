<#
.SYNOPSIS
    Creates, updates, lists and deletes DNS records on the Cloudflare zone
    named in .env.

.DESCRIPTION
    Wrangler has no `dns` command. The only subdomain it can create is a Workers
    Custom Domain: put the hostname in the `routes` block of wrangler.jsonc with
    "custom_domain": true and `wrangler deploy` writes the record for you. That
    covers website/, which is served by a Worker.

    Everything else -- a subdomain pointing at a VPS, a CNAME to some other
    host, a TXT record for domain verification -- has to go through the
    Cloudflare API, which is what this script wraps.

    Credentials are read from .env in the repo root, the same file wrangler
    reads. Nothing is passed on the command line, so no token lands in your
    shell history. If CLOUDFLARE_ZONE_ID is blank the zone is looked up from
    CF_ZONE_NAME instead.

    Writes are idempotent: a record matching the name and type is updated in
    place rather than duplicated, so re-running is safe.

.PARAMETER Name
    The record to act on. Either a bare label ("blog") which is joined to
    CF_ZONE_NAME, a full hostname ("blog.example.com"), or "@" for the apex.

.PARAMETER Type
    Record type. Defaults to CNAME.

.PARAMETER Content
    Where the record points: an IP for A/AAAA, a hostname for CNAME, free text
    for TXT.

.PARAMETER Proxied
    Whether Cloudflare proxies the record (the orange cloud). Defaults to true,
    and is ignored for types that cannot be proxied. Turn it off for anything
    that is not HTTP -- SSH, mail, a game server.

.PARAMETER Ttl
    Time to live in seconds. 1 means automatic, and is forced for proxied
    records because Cloudflare rejects anything else.

.PARAMETER Priority
    MX and SRV priority. Ignored for other types.

.PARAMETER Delete
    Remove the named record instead of writing it.

.EXAMPLE
    pwsh tools/cf-dns.ps1
    Lists every record on the zone.

.EXAMPLE
    pwsh tools/cf-dns.ps1 -Name blog -Type CNAME -Content puchne.pages.dev
    Points blog.<your domain> at a Pages deployment, proxied.

.EXAMPLE
    pwsh tools/cf-dns.ps1 -Name vpn -Type A -Content 203.0.113.4 -Proxied:$false
    Points vpn.<your domain> straight at a host, bypassing the proxy.

.EXAMPLE
    pwsh tools/cf-dns.ps1 -Name blog -Delete -WhatIf
    Shows what deleting blog.<your domain> would do, without doing it.
#>
[CmdletBinding(DefaultParameterSetName = 'List', SupportsShouldProcess)]
param(
    [Parameter(Mandatory, ParameterSetName = 'Upsert', Position = 0)]
    [Parameter(Mandatory, ParameterSetName = 'Delete', Position = 0)]
    [string] $Name,

    [Parameter(ParameterSetName = 'Upsert')]
    [Parameter(ParameterSetName = 'Delete')]
    [ValidateSet('A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SRV', 'CAA')]
    [string] $Type = 'CNAME',

    [Parameter(Mandatory, ParameterSetName = 'Upsert')]
    [string] $Content,

    [Parameter(ParameterSetName = 'Upsert')]
    [bool] $Proxied = $true,

    [Parameter(ParameterSetName = 'Upsert')]
    [int] $Ttl = 1,

    [Parameter(ParameterSetName = 'Upsert')]
    [int] $Priority = 10,

    [Parameter(Mandatory, ParameterSetName = 'Delete')]
    [switch] $Delete
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$apiUrl = 'https://api.cloudflare.com/client/v4'

# Same format wrangler accepts: KEY=value, # comments, optionally quoted values.
function Import-DotEnv {
    param([string] $Path)

    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $values }

    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { continue }
        $key = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value -match '^"(.*)"$' -or $value -match "^'(.*)'`$") { $value = $Matches[1] }
        $values[$key] = $value
    }
    return $values
}

$dotenv = Import-DotEnv (Join-Path $root '.env')

# Anything already in the environment wins, so CI can inject secrets without
# ever writing a .env file to disk.
function Get-Setting {
    param([string] $Key, [switch] $Required)

    $value = [Environment]::GetEnvironmentVariable($Key)
    if ([string]::IsNullOrWhiteSpace($value) -and $dotenv.ContainsKey($Key)) {
        $value = $dotenv[$Key]
    }
    if ($Required -and [string]::IsNullOrWhiteSpace($value)) {
        throw "$Key is not set. Copy .env.example to .env and fill it in, or set $Key in the environment."
    }
    return $value
}

$token = Get-Setting 'CLOUDFLARE_API_TOKEN' -Required
$zoneName = Get-Setting 'CF_ZONE_NAME' -Required
$zoneId = Get-Setting 'CLOUDFLARE_ZONE_ID'

function Invoke-CfApi {
    param(
        [string] $Method,
        [string] $Path,
        [hashtable] $Body
    )

    $params = @{
        Method      = $Method
        Uri         = "$apiUrl$Path"
        Headers     = @{ Authorization = "Bearer $token" }
        ContentType = 'application/json'
    }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 5 -Compress) }

    try {
        $response = Invoke-RestMethod @params
    }
    catch {
        # Cloudflare explains the failure in the response body, which
        # Invoke-RestMethod otherwise hides behind a bare "400 Bad Request".
        $detail = $null
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            try {
                $detail = ($_.ErrorDetails.Message | ConvertFrom-Json).errors |
                    ForEach-Object { "$($_.code): $($_.message)" }
            }
            catch { $detail = $_.ErrorDetails.Message }
        }
        if ($detail) { throw "Cloudflare API $Method $Path failed -- $($detail -join '; ')" }
        throw
    }

    if (-not $response.success) {
        $messages = $response.errors | ForEach-Object { "$($_.code): $($_.message)" }
        throw "Cloudflare API $Method $Path failed -- $($messages -join '; ')"
    }
    return $response.result
}

if ([string]::IsNullOrWhiteSpace($zoneId)) {
    Write-Verbose "CLOUDFLARE_ZONE_ID is blank; looking up '$zoneName'."
    $zones = @(Invoke-CfApi -Method GET -Path "/zones?name=$zoneName")
    if ($zones.Count -eq 0) {
        throw "No zone named '$zoneName' on this account. Check CF_ZONE_NAME, and that the token's Zone Resources include it."
    }
    $zoneId = $zones[0].id
    Write-Verbose "Resolved to $zoneId. Put it in .env as CLOUDFLARE_ZONE_ID to skip this call next time."
}

if ($PSCmdlet.ParameterSetName -eq 'List') {
    Invoke-CfApi -Method GET -Path "/zones/$zoneId/dns_records?per_page=500" |
        Sort-Object name, type |
        Select-Object @{ n = 'Name'; e = { $_.name } },
                      @{ n = 'Type'; e = { $_.type } },
                      @{ n = 'Content'; e = { $_.content } },
                      @{ n = 'Proxied'; e = { if ($_.PSObject.Properties['proxied'] -and $null -ne $_.proxied) { $_.proxied } else { '-' } } },
                      @{ n = 'TTL'; e = { if ($_.ttl -eq 1) { 'auto' } else { $_.ttl } } } |
        Format-Table -AutoSize
    return
}

# A bare label gets the zone appended; a name that already ends in the zone is
# left alone; "@" means the apex itself.
$suffix = '(^|\.)' + [regex]::Escape($zoneName) + '$'
$fqdn = if ($Name -eq '@') { $zoneName }
        elseif ($Name -match $suffix) { $Name }
        else { "$Name.$zoneName" }

$existing = @(Invoke-CfApi -Method GET -Path "/zones/$zoneId/dns_records?name=$fqdn&type=$Type")

if ($Delete) {
    if ($existing.Count -eq 0) {
        Write-Host "No $Type record for $fqdn -- nothing to delete."
        return
    }
    foreach ($record in $existing) {
        if ($PSCmdlet.ShouldProcess("$Type $fqdn -> $($record.content)", 'Delete DNS record')) {
            Invoke-CfApi -Method DELETE -Path "/zones/$zoneId/dns_records/$($record.id)" | Out-Null
            Write-Host "Deleted $Type $fqdn"
        }
    }
    return
}

$proxyable = $Type -in 'A', 'AAAA', 'CNAME'

$body = @{
    type    = $Type
    name    = $fqdn
    content = $Content
    comment = 'managed by tools/cf-dns.ps1'
}

if ($proxyable) {
    $body.proxied = $Proxied
    # Cloudflare rejects an explicit TTL on a proxied record; it serves those on
    # its own schedule regardless.
    $body.ttl = if ($Proxied) { 1 } else { $Ttl }
}
else {
    $body.ttl = $Ttl
}

if ($Type -in 'MX', 'SRV') { $body.priority = $Priority }

$target = "$Type $fqdn -> $Content"

if ($existing.Count -gt 0) {
    if ($PSCmdlet.ShouldProcess($target, 'Update DNS record')) {
        Invoke-CfApi -Method PUT -Path "/zones/$zoneId/dns_records/$($existing[0].id)" -Body $body | Out-Null
        Write-Host "Updated $target"
    }
    if ($existing.Count -gt 1) {
        Write-Warning "$($existing.Count) $Type records exist for $fqdn; updated the first and left the rest alone."
    }
}
else {
    if ($PSCmdlet.ShouldProcess($target, 'Create DNS record')) {
        Invoke-CfApi -Method POST -Path "/zones/$zoneId/dns_records" -Body $body | Out-Null
        Write-Host "Created $target"
    }
}

if ($proxyable -and $Proxied) {
    Write-Host 'Proxied through Cloudflare -- HTTPS is issued automatically, usually within a minute.'
}
