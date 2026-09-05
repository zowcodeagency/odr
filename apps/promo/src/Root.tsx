import { Composition } from "remotion";
import { FPS, TOTAL_FRAMES } from "./theme.ts";
import { Video } from "./Video.tsx";

const defaultProps = {
  tagline: "Made in Mangaluru, for every restaurant — big or small.",
  contact: "odr.zowcode.com",
  email: "sale@zowcode.com",
};

export const Root = () => (
  <>
    <Composition id="Odr" component={Video} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={defaultProps} />
    <Composition id="OdrPortrait" component={Video} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={defaultProps} />
  </>
);
