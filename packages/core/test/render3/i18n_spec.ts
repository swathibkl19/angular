/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {NgForOfContext} from '@angular/common';

import {noop} from '../../../compiler/src/render3/view/util';
import {Component as _Component} from '../../src/core';
import {ΔdefineComponent, ΔdefineDirective} from '../../src/render3/definition';
import {getTranslationForTemplate, Δi18n, Δi18nApply, Δi18nAttributes, Δi18nEnd, Δi18nExp, Δi18nPostprocess, Δi18nStart} from '../../src/render3/i18n';
import {ΔallocHostVars, Δbind, Δelement, ΔelementContainerEnd, ΔelementContainerStart, ΔelementEnd, ΔelementProperty, ΔelementStart, ΔnextContext, Δprojection, ΔprojectionDef, Δtemplate, Δtext, ΔtextBinding} from '../../src/render3/instructions/all';
import {RenderFlags} from '../../src/render3/interfaces/definition';
import {COMMENT_MARKER, ELEMENT_MARKER, I18nMutateOpCode, I18nUpdateOpCode, I18nUpdateOpCodes, IcuType, TI18n} from '../../src/render3/interfaces/i18n';
import {AttributeMarker} from '../../src/render3/interfaces/node';
import {HEADER_OFFSET, LView, TVIEW} from '../../src/render3/interfaces/view';
import {getNativeByIndex, getTNode} from '../../src/render3/util/view_utils';

import {NgForOf, NgIf} from './common_with_def';
import {ComponentFixture, TemplateFixture} from './render_util';

const Component: typeof _Component = function(...args: any[]): any {
  // In test we use @Component for documentation only so it's safe to mock out the implementation.
  return () => undefined;
} as any;

describe('Runtime i18n', () => {
  describe('getTranslationForTemplate', () => {
    it('should crop messages for the selected template', () => {
      let message = `simple text`;
      expect(getTranslationForTemplate(message)).toEqual(message);

      message = `Hello �0�!`;
      expect(getTranslationForTemplate(message)).toEqual(message);

      message = `Hello �#2��0��/#2�!`;
      expect(getTranslationForTemplate(message)).toEqual(message);

      // Embedded sub-templates
      message = `�0� is rendered as: �*2:1�before�*1:2�middle�/*1:2�after�/*2:1�!`;
      expect(getTranslationForTemplate(message)).toEqual('�0� is rendered as: �*2:1��/*2:1�!');
      expect(getTranslationForTemplate(message, 1)).toEqual('before�*1:2��/*1:2�after');
      expect(getTranslationForTemplate(message, 2)).toEqual('middle');

      // Embedded & sibling sub-templates
      message =
          `�0� is rendered as: �*2:1�before�*1:2�middle�/*1:2�after�/*2:1� and also �*4:3�before�*1:4�middle�/*1:4�after�/*4:3�!`;
      expect(getTranslationForTemplate(message))
          .toEqual('�0� is rendered as: �*2:1��/*2:1� and also �*4:3��/*4:3�!');
      expect(getTranslationForTemplate(message, 1)).toEqual('before�*1:2��/*1:2�after');
      expect(getTranslationForTemplate(message, 2)).toEqual('middle');
      expect(getTranslationForTemplate(message, 3)).toEqual('before�*1:4��/*1:4�after');
      expect(getTranslationForTemplate(message, 4)).toEqual('middle');
    });

    it('should throw if the template is malformed', () => {
      const message = `�*2:1�message!`;
      expect(() => getTranslationForTemplate(message)).toThrowError(/Tag mismatch/);
    });
  });

  function prepareFixture(
      createTemplate: () => void, updateTemplate: (() => void)|null, nbConsts = 0,
      nbVars = 0): TemplateFixture {
    return new TemplateFixture(createTemplate, updateTemplate || noop, nbConsts, nbVars);
  }

  function getOpCodes(
      createTemplate: () => void, updateTemplate: (() => void)|null, nbConsts: number,
      index: number): TI18n|I18nUpdateOpCodes {
    const fixture = prepareFixture(createTemplate, updateTemplate, nbConsts);
    const tView = fixture.hostView[TVIEW];
    return tView.data[index + HEADER_OFFSET] as TI18n;
  }

  describe('i18nStart', () => {
    it('for text', () => {
      const MSG_DIV = `simple text`;
      const nbConsts = 1;
      const index = 0;
      const opCodes = getOpCodes(() => { Δi18nStart(index, MSG_DIV); }, null, nbConsts, index);


      // Check debug
      const debugOps = (opCodes as any).create.debug !.operations;
      expect(debugOps[0].__raw_opCode).toBe('simple text');
      expect(debugOps[0].type).toBe('Create Text Node');
      expect(debugOps[0].nodeIndex).toBe(1);
      expect(debugOps[0].text).toBe('simple text');
      expect(debugOps[1].__raw_opCode).toBe(1);
      expect(debugOps[1].type).toBe('AppendChild');
      expect(debugOps[1].nodeIndex).toBe(0);

      expect(opCodes).toEqual({
        vars: 1,
        create: [
          'simple text', nbConsts,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild
        ],
        update: [],
        icus: null
      });
    });

    it('for elements', () => {
      const MSG_DIV = `Hello �#2�world�/#2� and �#3�universe�/#3�!`;
      // Template: `<div>Hello <div>world</div> and <span>universe</span>!`
      // 3 consts for the 2 divs and 1 span + 1 const for `i18nStart` = 4 consts
      const nbConsts = 4;
      const index = 1;
      const elementIndex = 2;
      const elementIndex2 = 3;
      const opCodes = getOpCodes(() => { Δi18nStart(index, MSG_DIV); }, null, nbConsts, index);

      expect(opCodes).toEqual({
        vars: 5,
        create: [
          'Hello ',
          nbConsts,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          elementIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Select,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          'world',
          nbConsts + 1,
          elementIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          elementIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.ElementEnd,
          ' and ',
          nbConsts + 2,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          elementIndex2 << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Select,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          'universe',
          nbConsts + 3,
          elementIndex2 << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          elementIndex2 << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.ElementEnd,
          '!',
          nbConsts + 4,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
        ],
        update: [],
        icus: null
      });
    });

    it('for simple bindings', () => {
      const MSG_DIV = `Hello �0�!`;
      const nbConsts = 2;
      const index = 1;
      const opCodes = getOpCodes(() => { Δi18nStart(index, MSG_DIV); }, null, nbConsts, index);

      expect((opCodes as any).update.debug.operations).toEqual([
        {__raw_opCode: 8, checkBit: 1, type: 'Text', nodeIndex: 2, text: 'Hello �0�!'}
      ]);

      expect(opCodes).toEqual({
        vars: 1,
        create:
            ['', nbConsts, index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild],
        update: [
          0b1,  // bindings mask
          4,    // if no update, skip 4
          'Hello ',
          -1,  // binding index
          '!', (index + 1) << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.Text
        ],
        icus: null
      });
    });

    it('for multiple bindings', () => {
      const MSG_DIV = `Hello �0� and �1�, again �0�!`;
      const nbConsts = 2;
      const index = 1;
      const opCodes = getOpCodes(() => { Δi18nStart(index, MSG_DIV); }, null, nbConsts, index);

      expect(opCodes).toEqual({
        vars: 1,
        create:
            ['', nbConsts, index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild],
        update: [
          0b11,  // bindings mask
          8,     // if no update, skip 8
          'Hello ', -1, ' and ', -2, ', again ', -1, '!',
          (index + 1) << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.Text
        ],
        icus: null
      });
    });

    it('for sub-templates', () => {
      // Template:
      // <div>
      //   {{value}} is rendered as:
      //   <span *ngIf>
      //     before <b *ngIf>middle</b> after
      //   </span>
      //   !
      // </div>
      const MSG_DIV =
          `�0� is rendered as: �*2:1��#1:1�before�*2:2��#1:2�middle�/#1:2��/*2:2�after�/#1:1��/*2:1�!`;

      /**** Root template ****/
      // �0� is rendered as: �*2:1��/*2:1�!
      let nbConsts = 3;
      let index = 1;
      const firstTextNode = 3;
      let opCodes = getOpCodes(() => { Δi18nStart(index, MSG_DIV); }, null, nbConsts, index);

      expect(opCodes).toEqual({
        vars: 2,
        create: [
          '',
          nbConsts,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          2 << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Select,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          '!',
          nbConsts + 1,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
        ],
        update: [
          0b1,  //  bindings mask
          3,    // if no update, skip 3
          -1,   // binding index
          ' is rendered as: ', firstTextNode << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.Text
        ],
        icus: null
      });


      /**** First sub-template ****/
      // �#1:1�before�*2:2�middle�/*2:2�after�/#1:1�
      nbConsts = 3;
      index = 0;
      const spanElement = 1;
      const bElementSubTemplate = 2;
      opCodes = getOpCodes(() => { Δi18nStart(index, MSG_DIV, 1); }, null, nbConsts, index);

      expect(opCodes).toEqual({
        vars: 2,
        create: [
          spanElement << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Select,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          'before',
          nbConsts,
          spanElement << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          bElementSubTemplate << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Select,
          spanElement << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          'after',
          nbConsts + 1,
          spanElement << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          spanElement << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.ElementEnd,
        ],
        update: [],
        icus: null
      });


      /**** Second sub-template ****/
      // middle
      nbConsts = 2;
      index = 0;
      const bElement = 1;
      opCodes = getOpCodes(() => { Δi18nStart(index, MSG_DIV, 2); }, null, nbConsts, index);

      expect(opCodes).toEqual({
        vars: 1,
        create: [
          bElement << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Select,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          'middle',
          nbConsts,
          bElement << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
          bElement << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.ElementEnd,
        ],
        update: [],
        icus: null
      });
    });

    it('for ICU expressions', () => {
      const MSG_DIV = `{�0�, plural,
        =0 {no <b title="none">emails</b>!}
        =1 {one <i>email</i>}
        other {�0� <span title="�1�">emails</span>}
      }`;
      const nbConsts = 1;
      const index = 0;
      const opCodes = getOpCodes(() => { Δi18nStart(index, MSG_DIV); }, null, nbConsts, index);
      const tIcuIndex = 0;
      const icuCommentNodeIndex = index + 1;
      const firstTextNodeIndex = index + 2;
      const bElementNodeIndex = index + 3;
      const iElementNodeIndex = index + 3;
      const spanElementNodeIndex = index + 3;
      const innerTextNode = index + 4;
      const lastTextNode = index + 5;

      const debugOps = (opCodes as any).update.debug.operations;
      expect(debugOps[0].__raw_opCode).toBe(6);
      expect(debugOps[0].checkBit).toBe(1);
      expect(debugOps[0].type).toBe('IcuSwitch');
      expect(debugOps[0].nodeIndex).toBe(1);
      expect(debugOps[0].tIcuIndex).toBe(0);
      expect(debugOps[0].mainBinding).toBe('�0�');

      expect(debugOps[1].__raw_opCode).toBe(7);
      expect(debugOps[1].checkBit).toBe(3);
      expect(debugOps[1].type).toBe('IcuUpdate');
      expect(debugOps[1].nodeIndex).toBe(1);
      expect(debugOps[1].tIcuIndex).toBe(0);

      const icuDebugOps = (opCodes as any).icus[0].create[0].debug.operations;
      let op: any;
      let i = 0;

      op = icuDebugOps[i++];
      expect(op.__raw_opCode).toBe('no ');
      expect(op.type).toBe('Create Text Node');
      expect(op.nodeIndex).toBe(2);
      expect(op.text).toBe('no ');

      op = icuDebugOps[i++];
      expect(op.__raw_opCode).toBe(131073);
      expect(op.type).toBe('AppendChild');
      expect(op.nodeIndex).toBe(1);

      op = icuDebugOps[i++];
      expect(op.__raw_opCode).toEqual({marker: 'element'});
      expect(op.type).toBe('ELEMENT_MARKER');

      op = icuDebugOps[i++];
      expect(op.__raw_opCode).toBe('b');
      expect(op.type).toBe('Create Text Node');
      expect(op.nodeIndex).toBe(3);
      expect(op.text).toBe('b');

      op = icuDebugOps[i++];
      expect(op.__raw_opCode).toBe(131073);
      expect(op.type).toBe('AppendChild');
      expect(op.nodeIndex).toBe(1);

      op = icuDebugOps[i++];
      expect(op.__raw_opCode).toBe(28);
      expect(op.type).toBe('Attr');
      expect(op.nodeIndex).toBe(3);
      expect(op.attrName).toBe('title');
      expect(op.attrValue).toBe('none');

      op = icuDebugOps[i++];
      expect(op.__raw_opCode).toBe('emails');
      expect(op.type).toBe('Create Text Node');
      expect(op.nodeIndex).toBe(4);
      expect(op.text).toBe('emails');

      op = icuDebugOps[i++];
      expect(op.__raw_opCode).toBe(393217);
      expect(op.type).toBe('AppendChild');
      expect(op.nodeIndex).toBe(3);

      op = icuDebugOps[i++];
      expect(op.__raw_opCode).toBe('!');
      expect(op.type).toBe('Create Text Node');
      expect(op.nodeIndex).toBe(5);
      expect(op.text).toBe('!');

      op = icuDebugOps[i++];
      expect(op.__raw_opCode).toBe(131073);
      expect(op.type).toBe('AppendChild');
      expect(op.nodeIndex).toBe(1);

      expect(opCodes).toEqual({
        vars: 5,
        create: [
          COMMENT_MARKER, 'ICU 1', icuCommentNodeIndex,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild
        ],
        update: [
          0b1,  // mask for ICU main binding
          3,    // skip 3 if not changed
          -1,   // icu main binding
          icuCommentNodeIndex << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.IcuSwitch, tIcuIndex,
          0b11,  // mask for all ICU bindings
          2,     // skip 2 if not changed
          icuCommentNodeIndex << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.IcuUpdate, tIcuIndex
        ],
        icus: [{
          type: 1,
          vars: [4, 3, 3],
          childIcus: [[], [], []],
          cases: ['0', '1', 'other'],
          create: [
            [
              'no ',
              firstTextNodeIndex,
              icuCommentNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
              ELEMENT_MARKER,
              'b',
              bElementNodeIndex,
              icuCommentNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
              bElementNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Attr,
              'title',
              'none',
              'emails',
              innerTextNode,
              bElementNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
              '!',
              lastTextNode,
              icuCommentNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
            ],
            [
              'one ', firstTextNodeIndex,
              icuCommentNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
              ELEMENT_MARKER, 'i', iElementNodeIndex,
              icuCommentNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
              'email', innerTextNode,
              iElementNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild
            ],
            [
              '', firstTextNodeIndex,
              icuCommentNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
              ELEMENT_MARKER, 'span', spanElementNodeIndex,
              icuCommentNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
              'emails', innerTextNode,
              spanElementNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild
            ]
          ],
          remove: [
            [
              firstTextNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
              innerTextNode << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
              bElementNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
              lastTextNode << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
            ],
            [
              firstTextNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
              innerTextNode << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
              iElementNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
            ],
            [
              firstTextNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
              innerTextNode << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
              spanElementNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
            ]
          ],
          update: [
            [], [],
            [
              0b1,  // mask for the first binding
              3,    // skip 3 if not changed
              -1,   // binding index
              ' ',  // text string to concatenate to the binding value
              firstTextNodeIndex << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.Text,
              0b10,  // mask for the title attribute binding
              4,     // skip 4 if not changed
              -2,    // binding index
              bElementNodeIndex << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.Attr,
              'title',  // attribute name
              null      // sanitize function
            ]
          ]
        }]
      });
    });

    it('for nested ICU expressions', () => {
      const MSG_DIV = `{�0�, plural,
        =0 {zero}
        other {�0� {�1�, select,
                       cat {cats}
                       dog {dogs}
                       other {animals}
                     }!}
      }`;
      const nbConsts = 1;
      const index = 0;
      const opCodes = getOpCodes(() => { Δi18nStart(index, MSG_DIV); }, null, nbConsts, index);
      const icuCommentNodeIndex = index + 1;
      const firstTextNodeIndex = index + 2;
      const nestedIcuCommentNodeIndex = index + 3;
      const lastTextNodeIndex = index + 4;
      const nestedTextNodeIndex = index + 5;
      const tIcuIndex = 1;
      const nestedTIcuIndex = 0;

      expect(opCodes).toEqual({
        vars: 6,
        create: [
          COMMENT_MARKER, 'ICU 1', icuCommentNodeIndex,
          index << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild
        ],
        update: [
          0b1,  // mask for ICU main binding
          3,    // skip 3 if not changed
          -1,   // icu main binding
          icuCommentNodeIndex << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.IcuSwitch, tIcuIndex,
          0b11,  // mask for all ICU bindings
          2,     // skip 2 if not changed
          icuCommentNodeIndex << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.IcuUpdate, tIcuIndex
        ],
        icus: [
          {
            type: 0,
            vars: [1, 1, 1],
            childIcus: [[], [], []],
            cases: ['cat', 'dog', 'other'],
            create: [
              [
                'cats', nestedTextNodeIndex, nestedIcuCommentNodeIndex
                        << I18nMutateOpCode.SHIFT_PARENT |
                    I18nMutateOpCode.AppendChild
              ],
              [
                'dogs', nestedTextNodeIndex, nestedIcuCommentNodeIndex
                        << I18nMutateOpCode.SHIFT_PARENT |
                    I18nMutateOpCode.AppendChild
              ],
              [
                'animals', nestedTextNodeIndex, nestedIcuCommentNodeIndex
                        << I18nMutateOpCode.SHIFT_PARENT |
                    I18nMutateOpCode.AppendChild
              ]
            ],
            remove: [
              [nestedTextNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove],
              [nestedTextNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove],
              [nestedTextNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove]
            ],
            update: [[], [], []]
          },
          {
            type: 1,
            vars: [1, 4],
            childIcus: [[], [0]],
            cases: ['0', 'other'],
            create: [
              [
                'zero', firstTextNodeIndex,
                icuCommentNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild
              ],
              [
                '', firstTextNodeIndex,
                icuCommentNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
                COMMENT_MARKER, 'nested ICU 0', nestedIcuCommentNodeIndex,
                icuCommentNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild,
                '!', lastTextNodeIndex,
                icuCommentNodeIndex << I18nMutateOpCode.SHIFT_PARENT | I18nMutateOpCode.AppendChild
              ]
            ],
            remove: [
              [firstTextNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove],
              [
                firstTextNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
                lastTextNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
                0 << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.RemoveNestedIcu,
                nestedIcuCommentNodeIndex << I18nMutateOpCode.SHIFT_REF | I18nMutateOpCode.Remove,
              ]
            ],
            update: [
              [],
              [
                0b1,  // mask for ICU main binding
                3,    // skip 3 if not changed
                -1,   // binding index
                ' ',  // text string to concatenate to the binding value
                firstTextNodeIndex << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.Text,
                0b10,  // mask for inner ICU main binding
                3,     // skip 3 if not changed
                -2,    // inner ICU main binding
                nestedIcuCommentNodeIndex << I18nUpdateOpCode.SHIFT_REF |
                    I18nUpdateOpCode.IcuSwitch,
                nestedTIcuIndex,
                0b10,  // mask for all inner ICU bindings
                2,     // skip 2 if not changed
                nestedIcuCommentNodeIndex << I18nUpdateOpCode.SHIFT_REF |
                    I18nUpdateOpCode.IcuUpdate,
                nestedTIcuIndex
              ]
            ]
          }
        ]
      });
    });
  });

  describe(`i18nEnd`, () => {
    it('for text', () => {
      const MSG_DIV = `simple text`;
      const fixture = prepareFixture(() => {
        ΔelementStart(0, 'div');
        Δi18n(1, MSG_DIV);
        ΔelementEnd();
      }, null, 2);

      expect(fixture.html).toEqual(`<div>${MSG_DIV}</div>`);
    });

    it('for bindings', () => {
      const MSG_DIV = `Hello �0�!`;
      const fixture = prepareFixture(() => {
        ΔelementStart(0, 'div');
        Δi18n(1, MSG_DIV);
        ΔelementEnd();
      }, null, 2);

      // Template should be empty because there is no update template function
      expect(fixture.html).toEqual('<div></div>');

      // But it should have created an empty text node in `viewData`
      const textTNode = fixture.hostView[HEADER_OFFSET + 2] as Node;
      expect(textTNode.nodeType).toEqual(Node.TEXT_NODE);
    });

    it('for elements', () => {
      const MSG_DIV = `Hello �#3�world�/#3� and �#2�universe�/#2�!`;
      let fixture = prepareFixture(() => {
        ΔelementStart(0, 'div');
        Δi18nStart(1, MSG_DIV);
        Δelement(2, 'div');
        Δelement(3, 'span');
        Δi18nEnd();
        ΔelementEnd();
      }, null, 4);

      expect(fixture.html).toEqual('<div>Hello <span>world</span> and <div>universe</div>!</div>');
    });

    it('for translations without top level element', () => {
      // When it's the first node
      let MSG_DIV = `Hello world`;
      let fixture = prepareFixture(() => { Δi18n(0, MSG_DIV); }, null, 1);

      expect(fixture.html).toEqual('Hello world');

      // When the first node is a text node
      MSG_DIV = ` world`;
      fixture = prepareFixture(() => {
        Δtext(0, 'Hello');
        Δi18n(1, MSG_DIV);
      }, null, 2);

      expect(fixture.html).toEqual('Hello world');

      // When the first node is an element
      fixture = prepareFixture(() => {
        ΔelementStart(0, 'div');
        Δtext(1, 'Hello');
        ΔelementEnd();
        Δi18n(2, MSG_DIV);
      }, null, 3);

      expect(fixture.html).toEqual('<div>Hello</div> world');

      // When there is a node after
      MSG_DIV = `Hello `;
      fixture = prepareFixture(() => {
        Δi18n(0, MSG_DIV);
        Δtext(1, 'world');
      }, null, 2);

      expect(fixture.html).toEqual('Hello world');
    });

    it('for deleted placeholders', () => {
      const MSG_DIV = `Hello �#3�world�/#3�`;
      let fixture = prepareFixture(() => {
        ΔelementStart(0, 'div');
        {
          Δi18nStart(1, MSG_DIV);
          {
            Δelement(2, 'div');  // Will be removed
            Δelement(3, 'span');
          }
          Δi18nEnd();
        }
        ΔelementEnd();
        ΔelementStart(4, 'div');
        { Δtext(5, '!'); }
        ΔelementEnd();
      }, null, 6);

      expect(fixture.html).toEqual('<div>Hello <span>world</span></div><div>!</div>');
    });

    it('for sub-templates', () => {
      // Template: `<div>Content: <div>before<span>middle</span>after</div>!</div>`;
      const MSG_DIV =
          `Content: �*2:1��#1:1�before�*2:2��#1:2�middle�/#1:2��/*2:2�after�/#1:1��/*2:1�!`;

      function subTemplate_1(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          Δi18nStart(0, MSG_DIV, 1);
          ΔelementStart(1, 'div');
          Δtemplate(2, subTemplate_2, 2, 0, 'span', [AttributeMarker.Template, 'ngIf']);
          ΔelementEnd();
          Δi18nEnd();
        }
        if (rf & RenderFlags.Update) {
          ΔelementProperty(2, 'ngIf', Δbind(true));
        }
      }

      function subTemplate_2(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          Δi18nStart(0, MSG_DIV, 2);
          Δelement(1, 'span');
          Δi18nEnd();
        }
      }

      class MyApp {
        static ngComponentDef = ΔdefineComponent({
          type: MyApp,
          selectors: [['my-app']],
          directives: [NgIf],
          factory: () => new MyApp(),
          consts: 3,
          vars: 1,
          template: (rf: RenderFlags, ctx: MyApp) => {
            if (rf & RenderFlags.Create) {
              ΔelementStart(0, 'div');
              Δi18nStart(1, MSG_DIV);
              Δtemplate(2, subTemplate_1, 3, 1, 'div', [AttributeMarker.Template, 'ngIf']);
              Δi18nEnd();
              ΔelementEnd();
            }
            if (rf & RenderFlags.Update) {
              ΔelementProperty(2, 'ngIf', true);
            }
          }
        });
      }

      const fixture = new ComponentFixture(MyApp);
      expect(fixture.html)
          .toEqual('<div>Content: <div>before<span>middle</span>after</div>!</div>');
    });

    it('for ICU expressions', () => {
      const MSG_DIV = `{�0�, plural,
        =0 {no <b title="none">emails</b>!}
        =1 {one <i>email</i>}
        other {�0� <span title="�1�">emails</span>}
      }`;
      const fixture = prepareFixture(() => {
        ΔelementStart(0, 'div');
        Δi18n(1, MSG_DIV);
        ΔelementEnd();
      }, null, 2);

      // Template should be empty because there is no update template function
      expect(fixture.html).toEqual('<div><!--ICU 2--></div>');
    });

    it('for multiple ICU expressions', () => {
      const MSG_DIV = `{�0�, plural,
        =0 {no <b title="none">emails</b>!}
        =1 {one <i>email</i>}
        other {�0� <span title="�1�">emails</span>}
      } - {�0�, select,
        other {(�0�)}
      }`;
      const fixture = prepareFixture(() => {
        ΔelementStart(0, 'div');
        Δi18n(1, MSG_DIV);
        ΔelementEnd();
      }, null, 2);

      // Template should be empty because there is no update template function
      expect(fixture.html).toEqual('<div><!--ICU 2--> - <!--ICU 8--></div>');
    });

    it('for multiple ICU expressions inside html', () => {
      const MSG_DIV = `�#2�{�0�, plural,
        =0 {no <b title="none">emails</b>!}
        =1 {one <i>email</i>}
        other {�0� <span title="�1�">emails</span>}
      }�/#2��#3�{�0�, select,
        other {(�0�)}
      }�/#3�`;
      const fixture = prepareFixture(() => {
        ΔelementStart(0, 'div');
        Δi18nStart(1, MSG_DIV);
        Δelement(2, 'span');
        Δelement(3, 'span');
        Δi18nEnd();
        ΔelementEnd();
      }, null, 4);

      // Template should be empty because there is no update template function
      expect(fixture.html).toEqual('<div><span><!--ICU 4--></span><span><!--ICU 9--></span></div>');
    });

    it('for ICU expressions inside templates', () => {
      const MSG_DIV = `�*2:1��#1:1�{�0:1�, plural,
        =0 {no <b title="none">emails</b>!}
        =1 {one <i>email</i>}
        other {�0:1� <span title="�1:1�">emails</span>}
      }�/#1:1��/*2:1�`;

      function subTemplate_1(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          Δi18nStart(0, MSG_DIV, 1);
          Δelement(1, 'span');
          Δi18nEnd();
        }
        if (rf & RenderFlags.Update) {
          const ctx = ΔnextContext();
          Δi18nExp(Δbind(ctx.value0));
          Δi18nExp(Δbind(ctx.value1));
          Δi18nApply(0);
        }
      }

      class MyApp {
        value0 = 0;
        value1 = 'emails label';

        static ngComponentDef = ΔdefineComponent({
          type: MyApp,
          selectors: [['my-app']],
          directives: [NgIf],
          factory: () => new MyApp(),
          consts: 3,
          vars: 1,
          template: (rf: RenderFlags, ctx: MyApp) => {
            if (rf & RenderFlags.Create) {
              ΔelementStart(0, 'div');
              Δi18nStart(1, MSG_DIV);
              Δtemplate(2, subTemplate_1, 2, 2, 'span', [AttributeMarker.Template, 'ngIf']);
              Δi18nEnd();
              ΔelementEnd();
            }
            if (rf & RenderFlags.Update) {
              ΔelementProperty(2, 'ngIf', true);
            }
          }
        });
      }

      const fixture = new ComponentFixture(MyApp);
      expect(fixture.html)
          .toEqual('<div><span>no <b title="none">emails</b>!<!--ICU 4--></span></div>');

      // Update the value
      fixture.component.value0 = 3;
      fixture.update();
      expect(fixture.html)
          .toEqual(
              '<div><span>3 <span title="emails label">emails</span><!--ICU 4--></span></div>');
    });

    it('for ICU expressions inside <ng-container>', () => {
      const MSG_DIV = `{�0�, plural,
        =0 {no <b title="none">emails</b>!}
        =1 {one <i>email</i>}
        other {�0� <span title="�1�">emails</span>}
      }`;
      const fixture = prepareFixture(
          () => {
            ΔelementStart(0, 'div');
            {
              ΔelementContainerStart(1);
              { Δi18n(2, MSG_DIV); }
              ΔelementContainerEnd();
            }
            ΔelementEnd();
          },
          () => {
            Δi18nExp(Δbind(0));
            Δi18nExp(Δbind('more than one'));
            Δi18nApply(2);
          },
          3, 2);

      expect(fixture.html).toEqual('<div>no <b title="none">emails</b>!<!--ICU 5--></div>');
    });

    it('for nested ICU expressions', () => {
      const MSG_DIV = `{�0�, plural,
        =0 {zero}
        other {�0� {�1�, select,
                       cat {cats}
                       dog {dogs}
                       other {animals}
                     }!}
      }`;
      const fixture = prepareFixture(() => {
        ΔelementStart(0, 'div');
        Δi18n(1, MSG_DIV);
        ΔelementEnd();
      }, null, 2);

      // Template should be empty because there is no update template function
      expect(fixture.html).toEqual('<div><!--ICU 2--></div>');
    });
  });

  describe(`i18nAttribute`, () => {
    it('for text', () => {
      const MSG_title = `Hello world!`;
      const MSG_div_attr = ['title', MSG_title];
      const nbConsts = 2;
      const index = 1;
      const fixture = prepareFixture(() => {
        ΔelementStart(0, 'div');
        Δi18nAttributes(index, MSG_div_attr);
        ΔelementEnd();
      }, null, nbConsts, index);
      const tView = fixture.hostView[TVIEW];
      const opCodes = tView.data[index + HEADER_OFFSET] as I18nUpdateOpCodes;

      expect(opCodes).toEqual([]);
      expect(
          (getNativeByIndex(0, fixture.hostView as LView) as any as Element).getAttribute('title'))
          .toEqual(MSG_title);
    });

    it('for simple bindings', () => {
      const MSG_title = `Hello �0�!`;
      const MSG_div_attr = ['title', MSG_title];
      const nbConsts = 2;
      const index = 1;
      const opCodes =
          getOpCodes(() => { Δi18nAttributes(index, MSG_div_attr); }, null, nbConsts, index);

      expect(opCodes).toEqual([
        0b1,  // bindings mask
        6,    // if no update, skip 4
        'Hello ',
        -1,  // binding index
        '!', (index - 1) << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.Attr, 'title', null
      ]);
    });

    it('for multiple bindings', () => {
      const MSG_title = `Hello �0� and �1�, again �0�!`;
      const MSG_div_attr = ['title', MSG_title];
      const nbConsts = 2;
      const index = 1;
      const opCodes =
          getOpCodes(() => { Δi18nAttributes(index, MSG_div_attr); }, null, nbConsts, index);

      expect(opCodes).toEqual([
        0b11,  // bindings mask
        10,    // size
        'Hello ', -1, ' and ', -2, ', again ', -1, '!',
        (index - 1) << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.Attr, 'title', null
      ]);
    });

    it('for multiple attributes', () => {
      const MSG_title = `Hello �0�!`;
      const MSG_div_attr = ['title', MSG_title, 'aria-label', MSG_title];
      const nbConsts = 2;
      const index = 1;
      const opCodes =
          getOpCodes(() => { Δi18nAttributes(index, MSG_div_attr); }, null, nbConsts, index);

      expect(opCodes).toEqual([
        0b1,  // bindings mask
        6,    // if no update, skip 4
        'Hello ',
        -1,  // binding index
        '!', (index - 1) << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.Attr, 'title', null,
        0b1,  // bindings mask
        6,    // if no update, skip 4
        'Hello ',
        -1,  // binding index
        '!', (index - 1) << I18nUpdateOpCode.SHIFT_REF | I18nUpdateOpCode.Attr, 'aria-label', null
      ]);
    });
  });

  describe(`i18nExp & i18nApply`, () => {
    it('for text bindings', () => {
      const MSG_DIV = `Hello �0�!`;
      const ctx = {value: 'world'};

      const fixture = prepareFixture(
          () => {
            ΔelementStart(0, 'div');
            Δi18n(1, MSG_DIV);
            ΔelementEnd();
          },
          () => {
            Δi18nExp(Δbind(ctx.value));
            Δi18nApply(1);
          },
          2, 1);

      // Template should be empty because there is no update template function
      expect(fixture.html).toEqual('<div>Hello world!</div>');
    });

    it('for attribute bindings', () => {
      const MSG_title = `Hello �0�!`;
      const MSG_div_attr = ['title', MSG_title];
      const ctx = {value: 'world'};

      const fixture = prepareFixture(
          () => {
            ΔelementStart(0, 'div');
            Δi18nAttributes(1, MSG_div_attr);
            ΔelementEnd();
          },
          () => {
            Δi18nExp(Δbind(ctx.value));
            Δi18nApply(1);
          },
          2, 1);

      expect(fixture.html).toEqual('<div title="Hello world!"></div>');

      // Change detection cycle, no model changes
      fixture.update();
      expect(fixture.html).toEqual('<div title="Hello world!"></div>');

      ctx.value = 'universe';
      fixture.update();
      expect(fixture.html).toEqual('<div title="Hello universe!"></div>');
    });

    it('for attributes with no bindings', () => {
      const MSG_title = `Hello world!`;
      const MSG_div_attr = ['title', MSG_title];

      const fixture = prepareFixture(
          () => {
            ΔelementStart(0, 'div');
            Δi18nAttributes(1, MSG_div_attr);
            ΔelementEnd();
          },
          () => { Δi18nApply(1); }, 2, 1);

      expect(fixture.html).toEqual('<div title="Hello world!"></div>');

      // Change detection cycle, no model changes
      fixture.update();
      expect(fixture.html).toEqual('<div title="Hello world!"></div>');
    });

    it('for multiple attribute bindings', () => {
      const MSG_title = `Hello �0� and �1�, again �0�!`;
      const MSG_div_attr = ['title', MSG_title];
      const ctx = {value0: 'world', value1: 'universe'};

      const fixture = prepareFixture(
          () => {
            ΔelementStart(0, 'div');
            Δi18nAttributes(1, MSG_div_attr);
            ΔelementEnd();
          },
          () => {
            Δi18nExp(Δbind(ctx.value0));
            Δi18nExp(Δbind(ctx.value1));
            Δi18nApply(1);
          },
          2, 2);

      expect(fixture.html).toEqual('<div title="Hello world and universe, again world!"></div>');

      // Change detection cycle, no model changes
      fixture.update();
      expect(fixture.html).toEqual('<div title="Hello world and universe, again world!"></div>');

      ctx.value0 = 'earth';
      fixture.update();
      expect(fixture.html).toEqual('<div title="Hello earth and universe, again earth!"></div>');

      ctx.value0 = 'earthlings';
      ctx.value1 = 'martians';
      fixture.update();
      expect(fixture.html)
          .toEqual('<div title="Hello earthlings and martians, again earthlings!"></div>');
    });

    it('for bindings of multiple attributes', () => {
      const MSG_title = `Hello �0�!`;
      const MSG_div_attr = ['title', MSG_title, 'aria-label', MSG_title];
      const ctx = {value: 'world'};

      const fixture = prepareFixture(
          () => {
            ΔelementStart(0, 'div');
            Δi18nAttributes(1, MSG_div_attr);
            ΔelementEnd();
          },
          () => {
            Δi18nExp(Δbind(ctx.value));
            Δi18nApply(1);
          },
          2, 1);

      expect(fixture.html).toEqual('<div aria-label="Hello world!" title="Hello world!"></div>');

      // Change detection cycle, no model changes
      fixture.update();
      expect(fixture.html).toEqual('<div aria-label="Hello world!" title="Hello world!"></div>');

      ctx.value = 'universe';
      fixture.update();
      expect(fixture.html)
          .toEqual('<div aria-label="Hello universe!" title="Hello universe!"></div>');
    });

    it('for ICU expressions', () => {
      const MSG_DIV = `{�0�, plural,
        =0 {no <b title="none">emails</b>!}
        =1 {one <i>email</i>}
        other {�0� <span title="�1�">emails</span>}
      }`;
      const ctx = {value0: 0, value1: 'emails label'};

      const fixture = prepareFixture(
          () => {
            ΔelementStart(0, 'div');
            Δi18n(1, MSG_DIV);
            ΔelementEnd();
          },
          () => {
            Δi18nExp(Δbind(ctx.value0));
            Δi18nExp(Δbind(ctx.value1));
            Δi18nApply(1);
          },
          2, 2);
      expect(fixture.html).toEqual('<div>no <b title="none">emails</b>!<!--ICU 4--></div>');

      // Change detection cycle, no model changes
      fixture.update();
      expect(fixture.html).toEqual('<div>no <b title="none">emails</b>!<!--ICU 4--></div>');

      ctx.value0 = 1;
      fixture.update();
      expect(fixture.html).toEqual('<div>one <i>email</i><!--ICU 4--></div>');

      ctx.value0 = 10;
      fixture.update();
      expect(fixture.html)
          .toEqual('<div>10 <span title="emails label">emails</span><!--ICU 4--></div>');

      ctx.value1 = '10 emails';
      fixture.update();
      expect(fixture.html)
          .toEqual('<div>10 <span title="10 emails">emails</span><!--ICU 4--></div>');

      ctx.value0 = 0;
      fixture.update();
      expect(fixture.html).toEqual('<div>no <b title="none">emails</b>!<!--ICU 4--></div>');
    });

    it('for multiple ICU expressions', () => {
      const MSG_DIV = `{�0�, plural,
        =0 {no <b title="none">emails</b>!}
        =1 {one <i>email</i>}
        other {�0� <span title="�1�">emails</span>}
      } - {�0�, select,
        other {(�0�)}
      }`;
      const ctx = {value0: 0, value1: 'emails label'};

      const fixture = prepareFixture(
          () => {
            ΔelementStart(0, 'div');
            Δi18n(1, MSG_DIV);
            ΔelementEnd();
          },
          () => {
            Δi18nExp(Δbind(ctx.value0));
            Δi18nExp(Δbind(ctx.value1));
            Δi18nApply(1);
          },
          2, 2);
      expect(fixture.html)
          .toEqual('<div>no <b title="none">emails</b>!<!--ICU 4--> - (0)<!--ICU 10--></div>');

      // Change detection cycle, no model changes
      fixture.update();
      expect(fixture.html)
          .toEqual('<div>no <b title="none">emails</b>!<!--ICU 4--> - (0)<!--ICU 10--></div>');

      ctx.value0 = 1;
      fixture.update();
      expect(fixture.html).toEqual('<div>one <i>email</i><!--ICU 4--> - (1)<!--ICU 10--></div>');

      ctx.value0 = 10;
      fixture.update();
      expect(fixture.html)
          .toEqual(
              '<div>10 <span title="emails label">emails</span><!--ICU 4--> - (10)<!--ICU 10--></div>');

      ctx.value1 = '10 emails';
      fixture.update();
      expect(fixture.html)
          .toEqual(
              '<div>10 <span title="10 emails">emails</span><!--ICU 4--> - (10)<!--ICU 10--></div>');

      ctx.value0 = 0;
      fixture.update();
      expect(fixture.html)
          .toEqual('<div>no <b title="none">emails</b>!<!--ICU 4--> - (0)<!--ICU 10--></div>');
    });

    it('for multiple ICU expressions', () => {
      const MSG_DIV = `�#2�{�0�, plural,
        =0 {no <b title="none">emails</b>!}
        =1 {one <i>email</i>}
        other {�0� <span title="�1�">emails</span>}
      }�/#2��#3�{�0�, select,
        other {(�0�)}
      }�/#3�`;
      const ctx = {value0: 0, value1: 'emails label'};

      const fixture = prepareFixture(
          () => {
            ΔelementStart(0, 'div');
            Δi18nStart(1, MSG_DIV);
            Δelement(2, 'span');
            Δelement(3, 'span');
            Δi18nEnd();
            ΔelementEnd();
          },
          () => {
            Δi18nExp(Δbind(ctx.value0));
            Δi18nExp(Δbind(ctx.value1));
            Δi18nApply(1);
          },
          4, 2);
      expect(fixture.html)
          .toEqual(
              '<div><span>no <b title="none">emails</b>!<!--ICU 6--></span><span>(0)<!--ICU 11--></span></div>');

      // Change detection cycle, no model changes
      fixture.update();
      expect(fixture.html)
          .toEqual(
              '<div><span>no <b title="none">emails</b>!<!--ICU 6--></span><span>(0)<!--ICU 11--></span></div>');

      ctx.value0 = 1;
      fixture.update();
      expect(fixture.html)
          .toEqual(
              '<div><span>one <i>email</i><!--ICU 6--></span><span>(1)<!--ICU 11--></span></div>');

      ctx.value0 = 10;
      fixture.update();
      expect(fixture.html)
          .toEqual(
              '<div><span>10 <span title="emails label">emails</span><!--ICU 6--></span><span>(10)<!--ICU 11--></span></div>');

      ctx.value1 = '10 emails';
      fixture.update();
      expect(fixture.html)
          .toEqual(
              '<div><span>10 <span title="10 emails">emails</span><!--ICU 6--></span><span>(10)<!--ICU 11--></span></div>');

      ctx.value0 = 0;
      fixture.update();
      expect(fixture.html)
          .toEqual(
              '<div><span>no <b title="none">emails</b>!<!--ICU 6--></span><span>(0)<!--ICU 11--></span></div>');
    });

    it('for nested ICU expressions', () => {
      const MSG_DIV = `{�0�, plural,
        =0 {zero}
        other {�0� {�1�, select,
                       cat {cats}
                       dog {dogs}
                       other {animals}
                     }!}
      }`;
      const ctx = {value0: 0, value1: 'cat'};

      const fixture = prepareFixture(
          () => {
            ΔelementStart(0, 'div');
            Δi18n(1, MSG_DIV);
            ΔelementEnd();
          },
          () => {
            Δi18nExp(Δbind(ctx.value0));
            Δi18nExp(Δbind(ctx.value1));
            Δi18nApply(1);
          },
          2, 2);

      expect(fixture.html).toEqual('<div>zero<!--ICU 4--></div>');

      // Change detection cycle, no model changes
      fixture.update();
      expect(fixture.html).toEqual('<div>zero<!--ICU 4--></div>');

      ctx.value0 = 10;
      fixture.update();
      expect(fixture.html).toEqual('<div>10 cats<!--nested ICU 0-->!<!--ICU 4--></div>');

      ctx.value1 = 'squirrel';
      fixture.update();
      expect(fixture.html).toEqual('<div>10 animals<!--nested ICU 0-->!<!--ICU 4--></div>');

      ctx.value0 = 0;
      fixture.update();
      expect(fixture.html).toEqual('<div>zero<!--ICU 4--></div>');
    });
  });

  describe('integration', () => {
    it('should support multiple i18n blocks', () => {
      // Translated template:
      // <div>
      //  <a i18n>
      //    trad {{exp1}}
      //  </a>
      //  hello
      //  <b i18n i18n-title title="start {{exp2}} middle {{exp1}} end">
      //    <e></e>
      //    <c>trad</c>
      //  </b>
      // </div>

      const MSG_DIV_1 = `trad �0�`;
      const MSG_DIV_2_ATTR = ['title', `start �1� middle �0� end`];
      const MSG_DIV_2 = `�#9��/#9��#7�trad�/#7�`;

      class MyApp {
        exp1 = '1';
        exp2 = '2';

        static ngComponentDef = ΔdefineComponent({
          type: MyApp,
          selectors: [['my-app']],
          factory: () => new MyApp(),
          consts: 10,
          vars: 2,
          template: (rf: RenderFlags, ctx: MyApp) => {
            if (rf & RenderFlags.Create) {
              ΔelementStart(0, 'div');
              {
                ΔelementStart(1, 'a');
                { Δi18n(2, MSG_DIV_1); }
                ΔelementEnd();
                Δtext(3, 'hello');
                ΔelementStart(4, 'b');
                {
                  Δi18nAttributes(5, MSG_DIV_2_ATTR);
                  Δi18nStart(6, MSG_DIV_2);
                  {
                    Δelement(7, 'c');
                    Δelement(8, 'd');  // will be removed
                    Δelement(9, 'e');  // will be moved before `c`
                  }
                  Δi18nEnd();
                }
                ΔelementEnd();
              }
              ΔelementEnd();
            }
            if (rf & RenderFlags.Update) {
              Δi18nExp(Δbind(ctx.exp1));
              Δi18nApply(2);
              Δi18nExp(Δbind(ctx.exp1));
              Δi18nExp(Δbind(ctx.exp2));
              Δi18nApply(5);
            }
          }
        });
      }

      const fixture = new ComponentFixture(MyApp);
      expect(fixture.html)
          .toEqual(
              `<div><a>trad 1</a>hello<b title="start 2 middle 1 end"><e></e><c>trad</c></b></div>`);
    });

    it('should support multiple sibling i18n blocks', () => {
      // Translated template:
      // <div>
      //  <div i18n>Section 1</div>
      //  <div i18n>Section 2</div>
      //  <div i18n>Section 3</div>
      // </div>

      const MSG_DIV_1 = `Section 1`;
      const MSG_DIV_2 = `Section 2`;
      const MSG_DIV_3 = `Section 3`;

      class MyApp {
        static ngComponentDef = ΔdefineComponent({
          type: MyApp,
          selectors: [['my-app']],
          factory: () => new MyApp(),
          consts: 7,
          vars: 0,
          template: (rf: RenderFlags, ctx: MyApp) => {
            if (rf & RenderFlags.Create) {
              ΔelementStart(0, 'div');
              {
                ΔelementStart(1, 'div');
                { Δi18n(2, MSG_DIV_1); }
                ΔelementEnd();
                ΔelementStart(3, 'div');
                { Δi18n(4, MSG_DIV_2); }
                ΔelementEnd();
                ΔelementStart(5, 'div');
                { Δi18n(6, MSG_DIV_3); }
                ΔelementEnd();
              }
              ΔelementEnd();
            }
            if (rf & RenderFlags.Update) {
              Δi18nApply(2);
              Δi18nApply(4);
              Δi18nApply(6);
            }
          }
        });
      }

      const fixture = new ComponentFixture(MyApp);
      expect(fixture.html)
          .toEqual(`<div><div>Section 1</div><div>Section 2</div><div>Section 3</div></div>`);
    });

    it('should support multiple sibling i18n blocks inside of *ngFor', () => {
      // Translated template:
      // <ul *ngFor="let item of [1,2,3]">
      //  <li i18n>Section 1</li>
      //  <li i18n>Section 2</li>
      //  <li i18n>Section 3</li>
      // </ul>

      const MSG_DIV_1 = `Section 1`;
      const MSG_DIV_2 = `Section 2`;
      const MSG_DIV_3 = `Section 3`;

      function liTemplate(rf: RenderFlags, ctx: NgForOfContext<string>) {
        if (rf & RenderFlags.Create) {
          ΔelementStart(0, 'ul');
          ΔelementStart(1, 'li');
          { Δi18n(2, MSG_DIV_1); }
          ΔelementEnd();
          ΔelementStart(3, 'li');
          { Δi18n(4, MSG_DIV_2); }
          ΔelementEnd();
          ΔelementStart(5, 'li');
          { Δi18n(6, MSG_DIV_3); }
          ΔelementEnd();
          ΔelementEnd();
        }
        if (rf & RenderFlags.Update) {
          Δi18nApply(2);
          Δi18nApply(4);
          Δi18nApply(6);
        }
      }

      class MyApp {
        items: string[] = ['1', '2', '3'];

        static ngComponentDef = ΔdefineComponent({
          type: MyApp,
          selectors: [['my-app']],
          factory: () => new MyApp(),
          consts: 2,
          vars: 1,
          template: (rf: RenderFlags, ctx: MyApp) => {
            if (rf & RenderFlags.Create) {
              ΔelementStart(0, 'div');
              {
                Δtemplate(
                    1, liTemplate, 7, 0, 'ul', [AttributeMarker.Template, 'ngFor', 'ngForOf']);
              }
              ΔelementEnd();
            }
            if (rf & RenderFlags.Update) {
              ΔelementProperty(1, 'ngForOf', Δbind(ctx.items));
            }
          },
          directives: () => [NgForOf]
        });
      }

      const fixture = new ComponentFixture(MyApp);
      expect(fixture.html)
          .toEqual(
              `<div><ul><li>Section 1</li><li>Section 2</li><li>Section 3</li></ul><ul><li>Section 1</li><li>Section 2</li><li>Section 3</li></ul><ul><li>Section 1</li><li>Section 2</li><li>Section 3</li></ul></div>`);
    });

    it('should support attribute translations on removed elements', () => {
      // Translated template:
      // <div i18n i18n-title title="start {{exp2}} middle {{exp1}} end">
      //    trad {{exp1}}
      // </div>

      const MSG_DIV_1 = `trad �0�`;
      const MSG_DIV_1_ATTR_1 = ['title', `start �1� middle �0� end`];

      class MyApp {
        exp1 = '1';
        exp2 = '2';

        static ngComponentDef = ΔdefineComponent({
          type: MyApp,
          selectors: [['my-app']],
          factory: () => new MyApp(),
          consts: 5,
          vars: 5,
          template: (rf: RenderFlags, ctx: MyApp) => {
            if (rf & RenderFlags.Create) {
              ΔelementStart(0, 'div');
              {
                Δi18nAttributes(1, MSG_DIV_1_ATTR_1);
                Δi18nStart(2, MSG_DIV_1);
                {
                  ΔelementStart(3, 'b');  // Will be removed
                  { Δi18nAttributes(4, MSG_DIV_1_ATTR_1); }
                  ΔelementEnd();
                }
                Δi18nEnd();
              }
              ΔelementEnd();
            }
            if (rf & RenderFlags.Update) {
              Δi18nExp(Δbind(ctx.exp1));
              Δi18nExp(Δbind(ctx.exp2));
              Δi18nApply(1);
              Δi18nExp(Δbind(ctx.exp1));
              Δi18nApply(2);
              Δi18nExp(Δbind(ctx.exp1));
              Δi18nExp(Δbind(ctx.exp2));
              Δi18nApply(4);
            }
          }
        });
      }

      const fixture = new ComponentFixture(MyApp);
      expect(fixture.html).toEqual(`<div title="start 2 middle 1 end">trad 1</div>`);
    });

    it('should work with directives and host bindings', () => {
      let directiveInstances: Directive[] = [];

      class Directive {
        // @HostBinding('className')
        klass = 'foo';

        static ngDirectiveDef = ΔdefineDirective({
          type: Directive,
          selectors: [['', 'dir', '']],
          factory: () => {
            const instance = new Directive();
            directiveInstances.push(instance);
            return instance;
          },
          hostBindings: (rf: RenderFlags, ctx: any, elementIndex: number) => {
            if (rf & RenderFlags.Create) {
              ΔallocHostVars(1);
            }
            if (rf & RenderFlags.Update) {
              ΔelementProperty(elementIndex, 'className', Δbind(ctx.klass), null, true);
            }
          }
        });
      }

      // Translated template:
      // <div i18n [test]="false" i18n-title title="start {{exp2}} middle {{exp1}} end">
      //    trad {�0�, plural,
      //         =0 {no <b title="none">emails</b>!}
      //         =1 {one <i>email</i>}
      //         other {�0� emails}
      //       }
      // </div>

      const MSG_DIV_1 = `trad {�0�, plural,
        =0 {no <b title="none">emails</b>!}
        =1 {one <i>email</i>}
        other {�0� emails}
      }`;
      const MSG_DIV_1_ATTR_1 = ['title', `start �1� middle �0� end`];

      class MyApp {
        exp1 = 1;
        exp2 = 2;

        static ngComponentDef = ΔdefineComponent({
          type: MyApp,
          selectors: [['my-app']],
          factory: () => new MyApp(),
          consts: 6,
          vars: 5,
          directives: [Directive],
          template: (rf: RenderFlags, ctx: MyApp) => {
            if (rf & RenderFlags.Create) {
              ΔelementStart(0, 'div', [AttributeMarker.Bindings, 'dir']);
              {
                Δi18nAttributes(1, MSG_DIV_1_ATTR_1);
                Δi18nStart(2, MSG_DIV_1);
                {
                  ΔelementStart(3, 'b', [AttributeMarker.Bindings, 'dir']);  // Will be removed
                  { Δi18nAttributes(4, MSG_DIV_1_ATTR_1); }
                  ΔelementEnd();
                }
                Δi18nEnd();
              }
              ΔelementEnd();
              Δelement(5, 'div', [AttributeMarker.Bindings, 'dir']);
            }
            if (rf & RenderFlags.Update) {
              Δi18nExp(Δbind(ctx.exp1));
              Δi18nExp(Δbind(ctx.exp2));
              Δi18nApply(1);
              Δi18nExp(Δbind(ctx.exp1));
              Δi18nApply(2);
              Δi18nExp(Δbind(ctx.exp1));
              Δi18nExp(Δbind(ctx.exp2));
              Δi18nApply(4);
            }
          }
        });
      }

      const fixture = new ComponentFixture(MyApp);
      // the "test" attribute should not be reflected in the DOM as it is here only for directive
      // matching purposes
      expect(fixture.html)
          .toEqual(
              `<div class="foo" title="start 2 middle 1 end">trad one <i>email</i><!--ICU 23--></div><div class="foo"></div>`);

      directiveInstances.forEach(instance => instance.klass = 'bar');
      fixture.component.exp1 = 2;
      fixture.component.exp2 = 3;
      fixture.update();
      expect(fixture.html)
          .toEqual(
              `<div class="bar" title="start 3 middle 2 end">trad 2 emails<!--ICU 23--></div><div class="bar"></div>`);
    });

    it('should fix the links when adding/moving/removing nodes', () => {
      const MSG_DIV = `�#2��/#2��#8��/#8��#4��/#4��#5��/#5�Hello World�#3��/#3��#7��/#7�`;
      let fixture = prepareFixture(() => {
        ΔelementStart(0, 'div');
        {
          Δi18nStart(1, MSG_DIV);
          {
            Δelement(2, 'div2');
            Δelement(3, 'div3');
            Δelement(4, 'div4');
            Δelement(5, 'div5');
            Δelement(6, 'div6');
            Δelement(7, 'div7');
            Δelement(8, 'div8');
          }
          Δi18nEnd();
        }
        ΔelementEnd();
      }, null, 9);

      expect(fixture.html)
          .toEqual(
              '<div><div2></div2><div8></div8><div4></div4><div5></div5>Hello World<div3></div3><div7></div7></div>');

      const div0 = getTNode(0, fixture.hostView);
      const div2 = getTNode(2, fixture.hostView);
      const div3 = getTNode(3, fixture.hostView);
      const div4 = getTNode(4, fixture.hostView);
      const div5 = getTNode(5, fixture.hostView);
      const div7 = getTNode(7, fixture.hostView);
      const div8 = getTNode(8, fixture.hostView);
      const text = getTNode(9, fixture.hostView);
      expect(div0.child).toEqual(div2);
      expect(div0.next).toBeNull();
      expect(div2.next).toEqual(div8);
      expect(div8.next).toEqual(div4);
      expect(div4.next).toEqual(div5);
      expect(div5.next).toEqual(text);
      expect(text.next).toEqual(div3);
      expect(div3.next).toEqual(div7);
      expect(div7.next).toBeNull();
    });

    describe('projection', () => {
      it('should project the translations', () => {
        @Component({selector: 'child', template: '<p><ng-content></ng-content></p>'})
        class Child {
          static ngComponentDef = ΔdefineComponent({
            type: Child,
            selectors: [['child']],
            factory: () => new Child(),
            consts: 2,
            vars: 0,
            template: (rf: RenderFlags, cmp: Child) => {
              if (rf & RenderFlags.Create) {
                ΔprojectionDef();
                ΔelementStart(0, 'p');
                { Δprojection(1); }
                ΔelementEnd();
              }
            }
          });
        }

        const MSG_DIV_SECTION_1 = `�#2�Je suis projeté depuis �#3��0��/#3��/#2�`;
        const MSG_ATTR_1 = ['title', `Enfant de �0�`];

        @Component({
          selector: 'parent',
          template: `
            <div i18n>
              <child>
                I am projected from
                <b i18n-title title="Child of {{name}}">{{name}}
                  <remove-me-1></remove-me-1>
                </b>
                <remove-me-2></remove-me-2>
              </child>
              <remove-me-3></remove-me-3>
            </div>`
          // Translated to:
          // <div i18n>
          //   <child>
          //     <p>
          //       Je suis projeté depuis <b i18n-title title="Enfant de {{name}}">{{name}}</b>
          //     </p>
          //   </child>
          // </div>
        })
        class Parent {
          name: string = 'Parent';
          static ngComponentDef = ΔdefineComponent({
            type: Parent,
            selectors: [['parent']],
            directives: [Child],
            factory: () => new Parent(),
            consts: 8,
            vars: 2,
            template: (rf: RenderFlags, cmp: Parent) => {
              if (rf & RenderFlags.Create) {
                ΔelementStart(0, 'div');
                {
                  Δi18nStart(1, MSG_DIV_SECTION_1);
                  {
                    ΔelementStart(2, 'child');
                    {
                      ΔelementStart(3, 'b');
                      {
                        Δi18nAttributes(4, MSG_ATTR_1);
                        Δelement(5, 'remove-me-1');
                      }
                      ΔelementEnd();
                      Δelement(6, 'remove-me-2');
                    }
                    ΔelementEnd();
                    Δelement(7, 'remove-me-3');
                  }
                  Δi18nEnd();
                }
                ΔelementEnd();
              }
              if (rf & RenderFlags.Update) {
                Δi18nExp(Δbind(cmp.name));
                Δi18nApply(1);
                Δi18nExp(Δbind(cmp.name));
                Δi18nApply(4);
              }
            }
          });
        }

        const fixture = new ComponentFixture(Parent);
        expect(fixture.html)
            .toEqual(
                '<div><child><p>Je suis projeté depuis <b title="Enfant de Parent">Parent</b></p></child></div>');
        // <div><child><p><b title="Enfant de Parent">Parent</b></p></child></div>
        // <div><child><p>Je suis projeté depuis <b title="Enfant de
        // Parent">Parent</b></p></child></div>
      });

      it('should project a translated i18n block', () => {
        @Component({selector: 'child', template: '<p><ng-content></ng-content></p>'})
        class Child {
          static ngComponentDef = ΔdefineComponent({
            type: Child,
            selectors: [['child']],
            factory: () => new Child(),
            consts: 2,
            vars: 0,
            template: (rf: RenderFlags, cmp: Child) => {
              if (rf & RenderFlags.Create) {
                ΔprojectionDef();
                ΔelementStart(0, 'p');
                { Δprojection(1); }
                ΔelementEnd();
              }
            }
          });
        }

        const MSG_DIV_SECTION_1 = `Je suis projeté depuis �0�`;
        const MSG_ATTR_1 = ['title', `Enfant de �0�`];

        @Component({
          selector: 'parent',
          template: `
        <div>
          <child>
            <any></any>
            <b i18n i18n-title title="Child of {{name}}">I am projected from {{name}}</b>
            <any></any>
          </child>
        </div>`
          // Translated to:
          // <div>
          //   <child>
          //     <any></any>
          //     <b i18n i18n-title title="Enfant de {{name}}">Je suis projeté depuis {{name}}</b>
          //     <any></any>
          //   </child>
          // </div>
        })
        class Parent {
          name: string = 'Parent';
          static ngComponentDef = ΔdefineComponent({
            type: Parent,
            selectors: [['parent']],
            directives: [Child],
            factory: () => new Parent(),
            consts: 7,
            vars: 2,
            template: (rf: RenderFlags, cmp: Parent) => {
              if (rf & RenderFlags.Create) {
                ΔelementStart(0, 'div');
                {
                  ΔelementStart(1, 'child');
                  {
                    Δelement(2, 'any');
                    ΔelementStart(3, 'b');
                    {
                      Δi18nAttributes(4, MSG_ATTR_1);
                      Δi18n(5, MSG_DIV_SECTION_1);
                    }
                    ΔelementEnd();
                    Δelement(6, 'any');
                  }
                  ΔelementEnd();
                }
                ΔelementEnd();
              }
              if (rf & RenderFlags.Update) {
                Δi18nExp(Δbind(cmp.name));
                Δi18nApply(4);
                Δi18nExp(Δbind(cmp.name));
                Δi18nApply(5);
              }
            }
          });
        }

        const fixture = new ComponentFixture(Parent);
        expect(fixture.html)
            .toEqual(
                '<div><child><p><any></any><b title="Enfant de Parent">Je suis projeté depuis Parent</b><any></any></p></child></div>');

        // it should be able to render a new component with the same template code
        const fixture2 = new ComponentFixture(Parent);
        expect(fixture2.html).toEqual(fixture.html);

        // Updating the fixture should work
        fixture2.component.name = 'Parent 2';
        fixture.update();
        fixture2.update();
        expect(fixture2.html)
            .toEqual(
                '<div><child><p><any></any><b title="Enfant de Parent 2">Je suis projeté depuis Parent 2</b><any></any></p></child></div>');

        // The first fixture should not have changed
        expect(fixture.html)
            .toEqual(
                '<div><child><p><any></any><b title="Enfant de Parent">Je suis projeté depuis Parent</b><any></any></p></child></div>');
      });

      it('should re-project translations when multiple projections', () => {
        @Component({selector: 'grand-child', template: '<div><ng-content></ng-content></div>'})
        class GrandChild {
          static ngComponentDef = ΔdefineComponent({
            type: GrandChild,
            selectors: [['grand-child']],
            factory: () => new GrandChild(),
            consts: 2,
            vars: 0,
            template: (rf: RenderFlags, cmp: Child) => {
              if (rf & RenderFlags.Create) {
                ΔprojectionDef();
                ΔelementStart(0, 'div');
                { Δprojection(1); }
                ΔelementEnd();
              }
            }
          });
        }

        @Component(
            {selector: 'child', template: '<grand-child><ng-content></ng-content></grand-child>'})
        class Child {
          static ngComponentDef = ΔdefineComponent({
            type: Child,
            selectors: [['child']],
            directives: [GrandChild],
            factory: () => new Child(),
            consts: 2,
            vars: 0,
            template: (rf: RenderFlags, cmp: Child) => {
              if (rf & RenderFlags.Create) {
                ΔprojectionDef();
                ΔelementStart(0, 'grand-child');
                { Δprojection(1); }
                ΔelementEnd();
              }
            }
          });
        }

        const MSG_DIV_SECTION_1 = `�#2�Bonjour�/#2� Monde!`;

        @Component({
          selector: 'parent',
          template: `<child i18n><b>Hello</b> World!</child>`
          // Translated to:
          // <child i18n><grand-child><div><b>Bonjour</b> Monde!</div></grand-child></child>
        })
        class Parent {
          name: string = 'Parent';
          static ngComponentDef = ΔdefineComponent({
            type: Parent,
            selectors: [['parent']],
            directives: [Child],
            factory: () => new Parent(),
            consts: 3,
            vars: 0,
            template: (rf: RenderFlags, cmp: Parent) => {
              if (rf & RenderFlags.Create) {
                ΔelementStart(0, 'child');
                {
                  Δi18nStart(1, MSG_DIV_SECTION_1);
                  { Δelement(2, 'b'); }
                  Δi18nEnd();
                }
                ΔelementEnd();
              }
            }
          });
        }

        const fixture = new ComponentFixture(Parent);
        expect(fixture.html)
            .toEqual('<child><grand-child><div><b>Bonjour</b> Monde!</div></grand-child></child>');
        // <child><grand-child><div><b>Bonjour</b></div></grand-child></child>
        // <child><grand-child><div><b>Bonjour</b> Monde!</div></grand-child></child>
      });

      xit('should re-project translations when removed placeholders', () => {
        @Component({selector: 'grand-child', template: '<div><ng-content></ng-content></div>'})
        class GrandChild {
          static ngComponentDef = ΔdefineComponent({
            type: GrandChild,
            selectors: [['grand-child']],
            factory: () => new GrandChild(),
            consts: 3,
            vars: 0,
            template: (rf: RenderFlags, cmp: Child) => {
              if (rf & RenderFlags.Create) {
                ΔprojectionDef();
                ΔelementStart(0, 'div');
                { Δprojection(1); }
                ΔelementEnd();
              }
            }
          });
        }

        @Component(
            {selector: 'child', template: '<grand-child><ng-content></ng-content></grand-child>'})
        class Child {
          static ngComponentDef = ΔdefineComponent({
            type: Child,
            selectors: [['child']],
            directives: [GrandChild],
            factory: () => new Child(),
            consts: 2,
            vars: 0,
            template: (rf: RenderFlags, cmp: Child) => {
              if (rf & RenderFlags.Create) {
                ΔprojectionDef();
                ΔelementStart(0, 'grand-child');
                { Δprojection(1); }
                ΔelementEnd();
              }
            }
          });
        }

        const MSG_DIV_SECTION_1 = `Bonjour Monde!`;

        @Component({
          selector: 'parent',
          template: `<child i18n><b>Hello</b> World!</child>`
          // Translated to:
          // <child i18n><grand-child><div>Bonjour Monde!</div></grand-child></child>
        })
        class Parent {
          name: string = 'Parent';
          static ngComponentDef = ΔdefineComponent({
            type: Parent,
            selectors: [['parent']],
            directives: [Child],
            factory: () => new Parent(),
            consts: 3,
            vars: 0,
            template: (rf: RenderFlags, cmp: Parent) => {
              if (rf & RenderFlags.Create) {
                ΔelementStart(0, 'child');
                {
                  Δi18nStart(1, MSG_DIV_SECTION_1);
                  {
                    Δelement(2, 'b');  // will be removed
                  }
                  Δi18nEnd();
                }
                ΔelementEnd();
              }
            }
          });
        }

        const fixture = new ComponentFixture(Parent);
        expect(fixture.html)
            .toEqual('<child><grand-child><div>Bonjour Monde!</div></grand-child></child>');
      });

      it('should project translations with selectors', () => {
        @Component({
          selector: 'child',
          template: `
          <ng-content select="span"></ng-content>
        `
        })
        class Child {
          static ngComponentDef = ΔdefineComponent({
            type: Child,
            selectors: [['child']],
            factory: () => new Child(),
            consts: 1,
            vars: 0,
            template: (rf: RenderFlags, cmp: Child) => {
              if (rf & RenderFlags.Create) {
                ΔprojectionDef([[['span']]]);
                Δprojection(0, 1);
              }
            }
          });
        }

        const MSG_DIV_SECTION_1 = `�#2�Contenu�/#2�`;

        @Component({
          selector: 'parent',
          template: `
          <child i18n>
            <span title="keepMe"></span>
            <span title="deleteMe"></span>
          </child>
        `
          // Translated to:
          // <child i18n><span title="keepMe">Contenu</span></child>
        })
        class Parent {
          static ngComponentDef = ΔdefineComponent({
            type: Parent,
            selectors: [['parent']],
            directives: [Child],
            factory: () => new Parent(),
            consts: 4,
            vars: 0,
            template: (rf: RenderFlags, cmp: Parent) => {
              if (rf & RenderFlags.Create) {
                ΔelementStart(0, 'child');
                {
                  Δi18nStart(1, MSG_DIV_SECTION_1);
                  {
                    Δelement(2, 'span', ['title', 'keepMe']);
                    Δelement(3, 'span', ['title', 'deleteMe']);
                  }
                  Δi18nEnd();
                }
                ΔelementEnd();
              }
            }
          });
        }

        const fixture = new ComponentFixture(Parent);
        expect(fixture.html).toEqual('<child><span title="keepMe">Contenu</span></child>');
      });
    });
  });

  describe('i18nPostprocess', () => {
    it('should handle valid cases', () => {
      const arr = ['�*1:1��#2:1�', '�#4:1�', '�6:1�', '�/#2:1��/*1:1�'];
      const str = `[${arr.join('|')}]`;

      const cases = [
        // empty string
        ['', {}, ''],

        // string without any special cases
        ['Foo [1,2,3] Bar - no ICU here', {}, 'Foo [1,2,3] Bar - no ICU here'],

        // multi-value cases
        [
          `Start: ${str}, ${str} and ${str}, ${str} end.`, {},
          `Start: ${arr[0]}, ${arr[1]} and ${arr[2]}, ${arr[3]} end.`
        ],

        // replace VAR_SELECT
        [
          'My ICU: {VAR_SELECT, select, =1 {one} other {other}}', {VAR_SELECT: '�1:2�'},
          'My ICU: {�1:2�, select, =1 {one} other {other}}'
        ],

        [
          'My ICU: {\n\n\tVAR_SELECT_1 \n\n, select, =1 {one} other {other}}',
          {VAR_SELECT_1: '�1:2�'}, 'My ICU: {\n\n\t�1:2� \n\n, select, =1 {one} other {other}}'
        ],

        // replace VAR_PLURAL
        [
          'My ICU: {VAR_PLURAL, plural, one {1} other {other}}', {VAR_PLURAL: '�1:2�'},
          'My ICU: {�1:2�, plural, one {1} other {other}}'
        ],

        [
          'My ICU: {\n\n\tVAR_PLURAL_1 \n\n, select, =1 {one} other {other}}',
          {VAR_PLURAL_1: '�1:2�'}, 'My ICU: {\n\n\t�1:2� \n\n, select, =1 {one} other {other}}'
        ],

        // do not replace VAR_* anywhere else in a string (only in ICU)
        [
          'My ICU: {VAR_PLURAL, plural, one {1} other {other}} VAR_PLURAL and VAR_SELECT',
          {VAR_PLURAL: '�1:2�'},
          'My ICU: {�1:2�, plural, one {1} other {other}} VAR_PLURAL and VAR_SELECT'
        ],

        // replace VAR_*'s in nested ICUs
        [
          'My ICU: {VAR_PLURAL, plural, one {1 - {VAR_SELECT, age, 50 {fifty} other {other}}} other {other}}',
          {VAR_PLURAL: '�1:2�', VAR_SELECT: '�5�'},
          'My ICU: {�1:2�, plural, one {1 - {�5�, age, 50 {fifty} other {other}}} other {other}}'
        ],

        [
          'My ICU: {VAR_PLURAL, plural, one {1 - {VAR_PLURAL_1, age, 50 {fifty} other {other}}} other {other}}',
          {VAR_PLURAL: '�1:2�', VAR_PLURAL_1: '�5�'},
          'My ICU: {�1:2�, plural, one {1 - {�5�, age, 50 {fifty} other {other}}} other {other}}'
        ],

        // ICU replacement
        [
          'My ICU #1: �I18N_EXP_ICU�, My ICU #2: �I18N_EXP_ICU�',
          {ICU: ['ICU_VALUE_1', 'ICU_VALUE_2']}, 'My ICU #1: ICU_VALUE_1, My ICU #2: ICU_VALUE_2'
        ],

        // mixed case
        [
          `Start: ${str}, ${str}. ICU: {VAR_SELECT, count, 10 {ten} other {other}}.
          Another ICU: �I18N_EXP_ICU� and ${str}, ${str} and one more ICU: �I18N_EXP_ICU� and end.`,
          {VAR_SELECT: '�1:2�', ICU: ['ICU_VALUE_1', 'ICU_VALUE_2']},
          `Start: ${arr[0]}, ${arr[1]}. ICU: {�1:2�, count, 10 {ten} other {other}}.
          Another ICU: ICU_VALUE_1 and ${arr[2]}, ${arr[3]} and one more ICU: ICU_VALUE_2 and end.`,
        ],
      ];
      cases.forEach(([input, replacements, output]) => {
        expect(Δi18nPostprocess(input as string, replacements as any)).toEqual(output as string);
      });
    });

    it('should handle nested template represented by multi-value placeholders', () => {
      /**
       * <div i18n>
       *   <span>
       *     Hello - 1
       *   </span>
       *   <span *ngIf="visible">
       *     Hello - 2
       *     <span *ngIf="visible">
       *       Hello - 3
       *       <span *ngIf="visible">
       *         Hello - 4
       *       </span>
       *     </span>
       *   </span>
       *   <span>
       *     Hello - 5
       *   </span>
       * </div>
       */
      const generated = `
        [�#2�|�#4�] Bonjour - 1 [�/#2�|�/#1:3��/*2:3�|�/#1:2��/*2:2�|�/#1:1��/*3:1�|�/#4�]
        [�*3:1��#1:1�|�*2:2��#1:2�|�*2:3��#1:3�]
          Bonjour - 2
          [�*3:1��#1:1�|�*2:2��#1:2�|�*2:3��#1:3�]
            Bonjour - 3
            [�*3:1��#1:1�|�*2:2��#1:2�|�*2:3��#1:3�] Bonjour - 4 [�/#2�|�/#1:3��/*2:3�|�/#1:2��/*2:2�|�/#1:1��/*3:1�|�/#4�]
          [�/#2�|�/#1:3��/*2:3�|�/#1:2��/*2:2�|�/#1:1��/*3:1�|�/#4�]
        [�/#2�|�/#1:3��/*2:3�|�/#1:2��/*2:2�|�/#1:1��/*3:1�|�/#4�]
        [�#2�|�#4�] Bonjour - 5 [�/#2�|�/#1:3��/*2:3�|�/#1:2��/*2:2�|�/#1:1��/*3:1�|�/#4�]
      `;
      const final = `
        �#2� Bonjour - 1 �/#2�
        �*3:1�
          �#1:1�
            Bonjour - 2
            �*2:2�
              �#1:2�
                Bonjour - 3
                �*2:3�
                  �#1:3� Bonjour - 4 �/#1:3�
                �/*2:3�
              �/#1:2�
            �/*2:2�
          �/#1:1�
        �/*3:1�
        �#4� Bonjour - 5 �/#4�
      `;
      expect(Δi18nPostprocess(generated.replace(/\s+/g, ''))).toEqual(final.replace(/\s+/g, ''));
    });

    it('should throw in case we have invalid string', () => {
      const arr = ['�*1:1��#2:1�', '�#4:2�', '�6:4�', '�/#2:1��/*1:1�'];
      const str = `[${arr.join('|')}]`;

      const cases = [
        // less placeholders than we have
        [`Start: ${str}, ${str} and ${str} end.`, {}],

        // more placeholders than we have
        [`Start: ${str}, ${str} and ${str}, ${str} ${str} end.`, {}],

        // not enough ICU replacements
        ['My ICU #1: �I18N_EXP_ICU�, My ICU #2: �I18N_EXP_ICU�', {ICU: ['ICU_VALUE_1']}]
      ];
      cases.forEach(([input, replacements, output]) => {
        expect(() => Δi18nPostprocess(input as string, replacements as any)).toThrowError();
      });
    });
  });
});
