import test from 'node:test';
import assert from 'node:assert/strict';
import { formatName, splitName } from '../src/shared/nameParts.ts';
test('optional name parts do not introduce blank gaps in the existing full-name field', () => {
  assert.equal(formatName({firstName:' Ana ',middleName:'',lastName:' Cruz ',suffix:''}),'Ana Cruz');
  assert.equal(formatName({firstName:'Ana',middleName:'Maria',lastName:'de la Cruz',suffix:'Jr.'}),'Ana Maria de la Cruz Jr.');
});
test('legacy names preserve word order and recognized suffixes', () => {
  for(const name of ['Maria Santos','Juan Dela Cruz','Ana Maria de la Cruz Jr.','Robert Smith III']) assert.equal(formatName(splitName(name)),name);
});
test('explicit frontend name parts preserve multiword family names', () => {
  const name={name:'Ana de la Cruz',firstName:'Ana',middleName:'',lastName:'de la Cruz',suffix:''};
  assert.equal(splitName(name).lastName,'de la Cruz');
  assert.equal(splitName('').firstName,'');
});
