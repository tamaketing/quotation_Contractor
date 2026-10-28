import { makeHandlers } from '../../_docs.js';
const H = makeHandlers('receipts', 'receipt_no');
export const onRequestGet = H.get;
export const onRequestPut = H.update;
export const onRequestDelete = H.remove;