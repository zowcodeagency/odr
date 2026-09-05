import { Config } from "@remotion/cli/config";

// The Mac already has Chrome; skip Remotion's own browser download.
Config.setBrowserExecutable("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
