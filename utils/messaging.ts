export type Message = 
  | { type: 'CAPTURE_VISIBLE' }
  | { type: 'CAPTURE_FULL_PAGE' }
  | { type: 'CAPTURE_AREA' }
  | { type: 'START_AREA_SELECTION' }
  | { type: 'CAPTURE_FRAGMENT' }
  | { type: 'SCROLL_AND_CAPTURE' }
  | { type: 'OPEN_DASHBOARD' }
  | { type: 'CROP_IMAGE', data: { dataUrl: string, area: any } };

export const sendMessage = async (message: Message) => {
  return await browser.runtime.sendMessage(message);
};
