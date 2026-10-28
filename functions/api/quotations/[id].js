import { makeHandlers } from '../../_docs.js';
const H = makeHandlers('quotations', 'quote_no');
export const onRequestGet = H.get;
export const onRequestPut = H.update;
export const onRequestDelete = H.remove;