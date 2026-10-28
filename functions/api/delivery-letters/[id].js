import { makeHandlers } from '../../_docs.js';
const H = makeHandlers('delivery_letters', 'letter_no');
export const onRequestGet = H.get;
export const onRequestPut = H.update;
export const onRequestDelete = H.remove;