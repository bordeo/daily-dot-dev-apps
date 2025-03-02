import React from 'react';
import classed from '../../lib/classed';

export enum OnboardingStep {
  Intro = 'intro',
  Topics = 'topics',
  Layout = 'layout',
  Theme = 'theme',
}

export const OnboardingTitle = classed(
  'h3',
  'text-center typo-title2 font-bold px-4',
);

export const OnboardingTitleGradient = classed(
  'h1',
  'font-bold text-transparent bg-clip-text bg-gradient-to-r from-theme-color-bacon to-theme-color-cabbage',
);

export interface OnboardingStepProps {
  onClose?: (e: React.MouseEvent | React.KeyboardEvent) => void;
  isModal?: boolean;
}
