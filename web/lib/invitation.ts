// Where and how big the guest's name sits on the traditional invitation card. The layout itself is shared
// with the API (which draws cards for automatic WhatsApp sends), so the two always match.
import layout from '../../functions/src/card-layout.js';

export type NameSlot = { top: number; maxSize: number };
export type CodeSlot = { top: number; left: number; size: number };
export type NameFont = { family: string; scale: number };
export type NameLayout = { lines: string[]; top: number; size: number; lineHeight: number; family: string };

/** Script fonts for the guest's name, with the scale that evens out their sizes. */
export const NAME_FONTS: readonly NameFont[] = layout.NAME_FONTS;
export const nameFont: (family?: string) => NameFont = layout.nameFont;
/** Long names go on two balanced lines so they stay legible inside the slot. Size is in % of card width. */
export const nameLayout: (name: string, slot: NameSlot, family?: string) => NameLayout = layout.nameLayout;
export const CODE_SPACING: number = layout.CODE_SPACING;
export const CARD_INK: string = layout.INK;
