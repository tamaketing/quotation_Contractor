import { makeHandlers } from '../../_docs.js';
const H = makeHandlers('invoices', 'invoice_no');
export const onRequestGet = H.list;
export const onRequestPost = H.create;