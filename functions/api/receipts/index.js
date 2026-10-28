import { makeHandlers } from '../../_docs.js';
const H = makeHandlers('receipts', 'receipt_no');
export const onRequestGet = H.list;
export const onRequestPost = H.create;