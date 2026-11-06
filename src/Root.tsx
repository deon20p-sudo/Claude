import React from "react";
import { Composition } from "remotion";
import { StrykerShort, STRYKER_FRAMES } from "./videos/stryker/Stryker";

export const RemotionRoot: React.FC = () => (
  <Composition id="StrykerShort" component={StrykerShort} durationInFrames={STRYKER_FRAMES} fps={30} width={1080} height={1920} />
);
