import {Config} from '@remotion/cli/config';

Config.setEntryPoint('./src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The panel and the grid are full of 1px borders — no chroma subsampling
// artefacts on them, please.
Config.setCrf(17);
