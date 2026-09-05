import { AbsoluteFill, Audio, Sequence, getStaticFiles, staticFile } from "remotion";
import { SCENES, VOICE_LEAD, sec, type SceneId } from "./theme.ts";
import { Hook } from "./scenes/Hook.tsx";
import { Floor } from "./scenes/Floor.tsx";
import { Kitchen } from "./scenes/Kitchen.tsx";
import { Bill } from "./scenes/Bill.tsx";
import { Channels } from "./scenes/Channels.tsx";
import { Sales } from "./scenes/Sales.tsx";
import { Outlets } from "./scenes/Outlets.tsx";
import { Close } from "./scenes/Close.tsx";

export type VideoProps = { tagline: string; contact: string; email: string };


/* Drop `voiceover.mp3` and/or `music.mp3` into public/ — they are picked up automatically. */
const has = (name: string) => getStaticFiles().some((f) => f.name === name);

const SCENE: Record<SceneId, (p: { durationInFrames: number } & VideoProps) => React.ReactElement> = {
  hook: Hook, floor: Floor, kitchen: Kitchen, bill: Bill, channels: Channels, sales: Sales, outlets: Outlets, close: Close,
};

export const Video = (props: VideoProps) => (
  <AbsoluteFill>
    {SCENES.map(({ id, from, to }) => {
      const Comp = SCENE[id];
      const durationInFrames = sec(to) - sec(from);
      return (
        <Sequence key={id} from={sec(from)} durationInFrames={durationInFrames}>
          <Comp durationInFrames={durationInFrames} {...props} />
        </Sequence>
      );
    })}
    {has("voiceover.mp3") ? (
      <Sequence from={sec(VOICE_LEAD)}><Audio src={staticFile("voiceover.mp3")} /></Sequence>
    ) : null}
    {has("music.mp3") ? <Audio src={staticFile("music.mp3")} volume={0.18} /> : null}
  </AbsoluteFill>
);
