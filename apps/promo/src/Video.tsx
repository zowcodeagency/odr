import { AbsoluteFill, Audio, Sequence, getStaticFiles, staticFile } from "remotion";
import { SCENES, sec, startOf, type SceneId } from "./theme.ts";
import { Hook } from "./scenes/Hook.tsx";
import { Floor } from "./scenes/Floor.tsx";
import { Kitchen } from "./scenes/Kitchen.tsx";
import { Bill } from "./scenes/Bill.tsx";
import { Channels } from "./scenes/Channels.tsx";
import { Sales } from "./scenes/Sales.tsx";
import { Outlets } from "./scenes/Outlets.tsx";
import { Close } from "./scenes/Close.tsx";

export type VideoProps = { tagline: string; contact: string };

const dur = (id: SceneId) => sec(SCENES.find((s) => s.id === id)!.seconds);

/* Drop `voiceover.mp3` and/or `music.mp3` into public/ — they are picked up automatically. */
const has = (name: string) => getStaticFiles().some((f) => f.name === name);

export const Video = ({ tagline, contact }: VideoProps) => (
  <AbsoluteFill>
    <Sequence from={startOf("hook")} durationInFrames={dur("hook")}><Hook durationInFrames={dur("hook")} /></Sequence>
    <Sequence from={startOf("floor")} durationInFrames={dur("floor")}><Floor durationInFrames={dur("floor")} /></Sequence>
    <Sequence from={startOf("kitchen")} durationInFrames={dur("kitchen")}><Kitchen durationInFrames={dur("kitchen")} /></Sequence>
    <Sequence from={startOf("bill")} durationInFrames={dur("bill")}><Bill durationInFrames={dur("bill")} /></Sequence>
    <Sequence from={startOf("channels")} durationInFrames={dur("channels")}><Channels durationInFrames={dur("channels")} /></Sequence>
    <Sequence from={startOf("sales")} durationInFrames={dur("sales")}><Sales durationInFrames={dur("sales")} /></Sequence>
    <Sequence from={startOf("outlets")} durationInFrames={dur("outlets")}><Outlets durationInFrames={dur("outlets")} /></Sequence>
    <Sequence from={startOf("close")} durationInFrames={dur("close")}><Close durationInFrames={dur("close")} tagline={tagline} contact={contact} /></Sequence>
    {has("voiceover.mp3") ? <Audio src={staticFile("voiceover.mp3")} /> : null}
    {has("music.mp3") ? <Audio src={staticFile("music.mp3")} volume={0.18} /> : null}
  </AbsoluteFill>
);
