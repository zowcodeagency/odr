import { Composition } from "remotion";
import { FPS, totalFrames, type Voice } from "./theme.ts";
import { Video } from "./Video.tsx";

const defaultProps = {
  tagline: "Made in Mangaluru, for every restaurant — big or small.",
  contact: "odr.zowcode.com",
  email: "sale@zowcode.com",
};

/* One composition per voice and orientation; the cut is timed to each voice. */
const cuts: [string, Voice, number, number][] = [
  ["Odr", "indian", 1920, 1080],
  ["OdrPortrait", "indian", 1080, 1920],
  ["OdrSystem", "system", 1920, 1080],
  ["OdrSystemPortrait", "system", 1080, 1920],
];

export const Root = () => (
  <>
    {cuts.map(([id, voice, width, height]) => (
      <Composition key={id} id={id} component={Video} durationInFrames={totalFrames(voice)} fps={FPS} width={width} height={height} defaultProps={{ ...defaultProps, voice }} />
    ))}
  </>
);
