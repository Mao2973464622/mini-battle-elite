import { Config } from '@remotion/cli/config';
import { W, H, FPS, TOTAL_FRAMES } from './src/engine';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
