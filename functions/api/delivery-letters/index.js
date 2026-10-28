import { makeHandlers } from '../../_docs.js';
const H = makeHandlers('delivery_letters', 'letter_no');
export const onRequestGet = H.list;
export const onRequestPost = H.create;