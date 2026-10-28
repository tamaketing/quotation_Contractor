import { makeHandlers } from '../../_docs.js';
const H = makeHandlers('quotations', 'quote_no');
export const onRequestGet = H.list;
export const onRequestPost = H.create;