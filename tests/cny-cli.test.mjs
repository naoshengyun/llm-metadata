import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
test('S: CLI refuses actual upstream dist even from another directory or via symlink',()=>{
 const root=process.cwd(), scratch=mkdtempSync(join(tmpdir(),'cny-cli-'));
 const outputName='cny-cli-test-'+scratch.split('/').at(-1);
 try {
 symlinkSync(join(root,'dist'),join(scratch,'alias'));
 for(const output of [join(root,'dist',outputName),join(scratch,'alias',outputName)]) {
  assert.throws(()=>execFileSync(process.execPath,[resolve('.cache/cny-build/cny/cli.js'),resolve('data/cny/synthetic-example.json'),output],{cwd:scratch,stdio:'pipe'}),e=>e.stderr.toString().includes('outside upstream dist'));
 }
 } finally {rmSync(join(root,'dist',outputName),{recursive:true,force:true});rmSync(scratch,{recursive:true,force:true});}
});
