/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Directive as _Directive, InjectionToken, OnChanges, OnDestroy, Pipe as _Pipe, PipeTransform, WrappedValue, ɵNgModuleDef as NgModuleDef, ΔdefineComponent as defineComponent, ΔdefineInjectable, ΔdefineInjector, ΔdirectiveInject as directiveInject} from '@angular/core';
import {expect} from '@angular/platform-browser/testing/src/matchers';

import {createInjector} from '../../src/di/r3_injector';
import {ΔdefineDirective, ΔdefinePipe} from '../../src/render3/definition';
import {Δbind, Δcontainer, ΔcontainerRefreshEnd, ΔcontainerRefreshStart, ΔelementEnd, ΔelementProperty, ΔelementStart, ΔembeddedViewEnd, ΔembeddedViewStart, Δinterpolation1, Δload, Δtext, ΔtextBinding} from '../../src/render3/instructions/all';
import {RenderFlags} from '../../src/render3/interfaces/definition';
import {Δpipe, ΔpipeBind1, ΔpipeBind3, ΔpipeBind4, ΔpipeBindV} from '../../src/render3/pipe';

import {RenderLog, getRendererFactory2, patchLoggingRenderer2} from './imported_renderer2';
import {ComponentFixture, TemplateFixture, createComponent, getDirectiveOnNode, renderToHtml} from './render_util';

const Directive: typeof _Directive = function(...args: any[]): any {
  // In test we use @Directive for documentation only so it's safe to mock out the implementation.
  return () => undefined;
} as any;
const Pipe: typeof _Pipe = function(...args: any[]): any {
  // In test we use @Pipe for documentation only so it's safe to mock out the implementation.
  return () => undefined;
} as any;

let log: string[] = [];
let person: Person;
let renderLog: RenderLog = new RenderLog();
const rendererFactory2 = getRendererFactory2(document);
patchLoggingRenderer2(rendererFactory2, renderLog);

describe('pipe', () => {
  beforeEach(() => {
    log = [];
    renderLog.clear();
    person = new Person();
  });

  const pipes =
      () => [CountingPipe, MultiArgPipe, CountingImpurePipe, DuplicatePipe1, DuplicatePipe2];

  it('should support interpolation', () => {
    function Template(rf: RenderFlags, person: Person) {
      if (rf & RenderFlags.Create) {
        Δtext(0);
        Δpipe(1, 'countingPipe');
      }
      if (rf & RenderFlags.Update) {
        ΔtextBinding(0, Δinterpolation1('', ΔpipeBind1(1, 1, person.name), ''));
      }
    }

    person.init('bob', null);
    expect(renderToHtml(Template, person, 2, 3, null, pipes)).toEqual('bob state:0');
  });

  it('should throw if pipe is not found', () => {
    const App = createComponent('app', function(rf: RenderFlags, ctx: any) {
      if (rf & RenderFlags.Create) {
        Δtext(0);
        Δpipe(1, 'randomPipeName');
      }
      if (rf & RenderFlags.Update) {
        ΔtextBinding(0, Δinterpolation1('', ΔpipeBind1(1, 1, ctx.value), ''));
      }
    }, 2, 3, [], pipes);

    expect(() => {
      const fixture = new ComponentFixture(App);
    }).toThrowError(/The pipe 'randomPipeName' could not be found!/);
  });

  it('should support bindings', () => {
    let directive: any = null;

    @Directive({selector: '[my-dir]', inputs: ['dirProp: elprop'], exportAs: 'mydir'})
    class MyDir {
      dirProp: string;

      constructor() { this.dirProp = ''; }

      static ngDirectiveDef = ΔdefineDirective({
        type: MyDir,
        selectors: [['', 'myDir', '']],
        factory: () => new MyDir(),
        inputs: {dirProp: 'elprop'}
      });
    }

    @Pipe({name: 'double'})
    class DoublePipe implements PipeTransform {
      transform(value: any) { return `${value}${value}`; }

      static ngPipeDef = ΔdefinePipe({
        name: 'double',
        type: DoublePipe,
        factory: function DoublePipe_Factory() { return new DoublePipe(); },
      });
    }

    function Template(rf: RenderFlags, ctx: string) {
      if (rf & RenderFlags.Create) {
        ΔelementStart(0, 'div', ['myDir', '']);
        Δpipe(1, 'double');
        ΔelementEnd();
      }
      if (rf & RenderFlags.Update) {
        ΔelementProperty(0, 'elprop', Δbind(ΔpipeBind1(1, 1, ctx)));
        directive = getDirectiveOnNode(0);
      }
    }
    renderToHtml(Template, 'a', 2, 3, [MyDir], [DoublePipe]);
    expect(directive !.dirProp).toEqual('aa');
  });

  it('should support arguments in pipes', () => {
    function Template(rf: RenderFlags, person: Person) {
      if (rf & RenderFlags.Create) {
        Δtext(0);
        Δpipe(1, 'multiArgPipe');
      }
      if (rf & RenderFlags.Update) {
        ΔtextBinding(
            0,
            Δinterpolation1('', ΔpipeBind3(1, 1, person.name, 'one', person.address !.city), ''));
      }
    }

    person.init('value', new Address('two'));
    expect(renderToHtml(Template, person, 2, 5, null, pipes)).toEqual('value one two default');
  });

  it('should support calling pipes with different number of arguments', () => {
    function Template(rf: RenderFlags, person: Person) {
      if (rf & RenderFlags.Create) {
        Δtext(0);
        Δpipe(1, 'multiArgPipe');
        Δpipe(2, 'multiArgPipe');
      }
      if (rf & RenderFlags.Update) {
        ΔtextBinding(
            0, Δinterpolation1(
                   '', ΔpipeBind4(2, 5, ΔpipeBindV(1, 1, [person.name, 'a', 'b']), 0, 1, 2), ''));
      }
    }

    person.init('value', null);
    expect(renderToHtml(Template, person, 3, 10, null, pipes)).toEqual('value a b default 0 1 2');
  });

  it('should do nothing when no change', () => {
    @Pipe({name: 'identityPipe'})
    class IdentityPipe implements PipeTransform {
      transform(value: any) { return value; }

      static ngPipeDef = ΔdefinePipe({
        name: 'identityPipe',
        type: IdentityPipe,
        factory: function IdentityPipe_Factory() { return new IdentityPipe(); },
      });
    }

    function Template(rf: RenderFlags, person: Person) {
      if (rf & RenderFlags.Create) {
        ΔelementStart(0, 'div');
        Δpipe(1, 'identityPipe');
        ΔelementEnd();
      }
      if (rf & RenderFlags.Update) {
        ΔelementProperty(0, 'id', Δbind(ΔpipeBind1(1, 1, 'Megatron')));
      }
    }

    renderToHtml(Template, person, 2, 3, null, [IdentityPipe], rendererFactory2);
    expect(renderLog.log).toEqual(['id=Megatron']);

    renderLog.clear();
    renderToHtml(Template, person, 2, 3, null, pipes, rendererFactory2);
    expect(renderLog.log).toEqual([]);
  });

  it('should support duplicates by using the later entry', () => {
    function Template(rf: RenderFlags, person: Person) {
      if (rf & RenderFlags.Create) {
        Δtext(0);
        Δpipe(1, 'duplicatePipe');
      }
      if (rf & RenderFlags.Update) {
        ΔtextBinding(0, Δinterpolation1('', ΔpipeBind1(1, 1, person.name), ''));
      }
    }

    person.init('bob', null);
    expect(renderToHtml(Template, person, 2, 3, null, pipes)).toEqual('bob from duplicate 2');
  });

  describe('pure', () => {
    it('should call pure pipes only if the arguments change', () => {
      function Template(rf: RenderFlags, person: Person) {
        if (rf & RenderFlags.Create) {
          Δtext(0);
          Δpipe(1, 'countingPipe');
        }
        if (rf & RenderFlags.Update) {
          ΔtextBinding(0, Δinterpolation1('', ΔpipeBind1(1, 1, person.name), ''));
        }
      }

      // change from undefined -> null
      person.name = null;
      expect(renderToHtml(Template, person, 2, 3, null, pipes)).toEqual('null state:0');
      expect(renderToHtml(Template, person, 2, 3, null, pipes)).toEqual('null state:0');

      // change from null -> some value
      person.name = 'bob';
      expect(renderToHtml(Template, person, 2, 3, null, pipes)).toEqual('bob state:1');
      expect(renderToHtml(Template, person, 2, 3, null, pipes)).toEqual('bob state:1');

      // change from some value -> some other value
      person.name = 'bart';
      expect(renderToHtml(Template, person, 2, 3, null, pipes)).toEqual('bart state:2');
      expect(renderToHtml(Template, person, 2, 3, null, pipes)).toEqual('bart state:2');
    });
  });

  describe('impure', () => {
    it('should call impure pipes on each change detection run', () => {
      function Template(rf: RenderFlags, person: Person) {
        if (rf & RenderFlags.Create) {
          Δtext(0);
          Δpipe(1, 'countingImpurePipe');
        }
        if (rf & RenderFlags.Update) {
          ΔtextBinding(0, Δinterpolation1('', ΔpipeBind1(1, 1, person.name), ''));
        }
      }

      person.name = 'bob';
      expect(renderToHtml(Template, person, 2, 3, null, pipes)).toEqual('bob state:0');
      expect(renderToHtml(Template, person, 2, 3, null, pipes)).toEqual('bob state:1');
    });

    it('should not cache impure pipes', () => {
      function Template(rf: RenderFlags, ctx: any) {
        if (rf & RenderFlags.Create) {
          ΔelementStart(0, 'div');
          Δpipe(1, 'countingImpurePipe');
          ΔelementEnd();
          ΔelementStart(2, 'div');
          Δpipe(3, 'countingImpurePipe');
          ΔelementEnd();
          Δcontainer(4);
        }
        if (rf & RenderFlags.Update) {
          ΔelementProperty(0, 'id', Δbind(ΔpipeBind1(1, 2, true)));
          ΔelementProperty(2, 'id', Δbind(ΔpipeBind1(3, 4, true)));
          pipeInstances.push(Δload<CountingImpurePipe>(1), Δload(3));
          ΔcontainerRefreshStart(4);
          {
            for (let i of [1, 2]) {
              let rf1 = ΔembeddedViewStart(1, 2, 3);
              {
                if (rf1 & RenderFlags.Create) {
                  ΔelementStart(0, 'div');
                  Δpipe(1, 'countingImpurePipe');
                  ΔelementEnd();
                }
                if (rf1 & RenderFlags.Update) {
                  ΔelementProperty(0, 'id', Δbind(ΔpipeBind1(1, 1, true)));
                  pipeInstances.push(Δload<CountingImpurePipe>(1));
                }
              }
              ΔembeddedViewEnd();
            }
          }
          ΔcontainerRefreshEnd();
        }
      }

      const pipeInstances: CountingImpurePipe[] = [];
      renderToHtml(Template, {}, 5, 6, null, pipes, rendererFactory2);
      expect(pipeInstances.length).toEqual(4);
      expect(pipeInstances[0]).toBeAnInstanceOf(CountingImpurePipe);
      expect(pipeInstances[1]).toBeAnInstanceOf(CountingImpurePipe);
      expect(pipeInstances[1]).not.toBe(pipeInstances[0]);
      expect(pipeInstances[2]).toBeAnInstanceOf(CountingImpurePipe);
      expect(pipeInstances[2]).not.toBe(pipeInstances[0]);
      expect(pipeInstances[3]).toBeAnInstanceOf(CountingImpurePipe);
      expect(pipeInstances[3]).not.toBe(pipeInstances[0]);
    });
  });

  describe('lifecycles', () => {
    @Pipe({name: 'pipeWithOnDestroy'})
    class PipeWithOnDestroy implements PipeTransform, OnDestroy {
      ngOnDestroy() { log.push('pipeWithOnDestroy - ngOnDestroy'); }

      transform(value: any): any { return null; }

      static ngPipeDef = ΔdefinePipe({
        name: 'pipeWithOnDestroy',
        type: PipeWithOnDestroy,
        factory: function PipeWithOnDestroy_Factory() { return new PipeWithOnDestroy(); },
      });
    }

    it('should call ngOnDestroy on pipes', () => {
      function Template(rf: RenderFlags, person: Person) {
        if (rf & RenderFlags.Create) {
          Δcontainer(0);
        }
        if (rf & RenderFlags.Update) {
          ΔcontainerRefreshStart(0);
          {
            if (person.age > 20) {
              let rf1 = ΔembeddedViewStart(1, 2, 3);
              {
                if (rf1 & RenderFlags.Create) {
                  Δtext(0);
                  Δpipe(1, 'pipeWithOnDestroy');
                }
                if (rf & RenderFlags.Update) {
                  ΔtextBinding(0, Δinterpolation1('', ΔpipeBind1(1, 1, person.age), ''));
                }
              }
              ΔembeddedViewEnd();
            }
          }
          ΔcontainerRefreshEnd();
        }
      }
      const pipes = [PipeWithOnDestroy];

      person.age = 25;
      renderToHtml(Template, person, 1, 0, null, pipes);

      person.age = 15;
      renderToHtml(Template, person, 1, 0, null, pipes);
      expect(log).toEqual(['pipeWithOnDestroy - ngOnDestroy']);

      log = [];
      person.age = 30;
      renderToHtml(Template, person, 1, 0, null, pipes);
      expect(log).toEqual([]);

      log = [];
      person.age = 10;
      renderToHtml(Template, person, 1, 0, null, pipes);
      expect(log).toEqual(['pipeWithOnDestroy - ngOnDestroy']);
    });
  });

  describe('injection mechanism', () => {
    class ServiceA {
      title = 'ServiceA Title';
    }

    class ServiceB {
      title = 'ServiceB Title';

      static ngInjectableDef =
          ΔdefineInjectable({providedIn: 'root', factory: () => new ServiceB()});
    }

    class ModuleA {
      static ngInjectorDef = ΔdefineInjector({factory: () => new ModuleA(), providers: [ServiceA]});
      static ngModuleDef: NgModuleDef<any> = { bootstrap: [] } as any;
    }

    const generatePipe = (InjectionType: any) => {
      return class MyConcatPipe implements PipeTransform {
        constructor(public obj: any) {}

        transform(value: string): string { return `${value} - ${this.obj.title}`; }

        static ngPipeDef = ΔdefinePipe({
          name: 'myConcatPipe',
          type: MyConcatPipe,
          factory: () => new MyConcatPipe(directiveInject(InjectionType)),
          pure: false
        });
      };
    };

    const generateComponent = (overrides: any) => {
      return class MyComponent {
        title = 'MyComponent Title';

        static ngComponentDef = defineComponent({
          type: MyComponent,
          selectors: [['my-app']],
          factory: function MyComponent_Factory() { return new MyComponent(); },
          consts: 2,
          vars: 3,
          // '{{ title | myConcatPipe }}'
          template: (rf: RenderFlags, ctx: MyComponent) => {
            if (rf & 1) {
              Δtext(0);
              Δpipe(1, 'myConcatPipe');
            }
            if (rf & 2) {
              ΔtextBinding(0, Δinterpolation1('', ΔpipeBind1(1, 1, ctx.title), ''));
            }
          },
          ...overrides
        });
      };
    };

    it('should be able to handle Service injection', () => {
      const Comp = generateComponent({providers: [ServiceB], pipes: [generatePipe(ServiceB)]});
      const fixture = new ComponentFixture(Comp);
      expect(fixture.html).toEqual('MyComponent Title - ServiceB Title');
    });

    it('should be able to handle Token injections', () => {
      const provider = new InjectionToken<ServiceA>(
          'token', {providedIn: 'root', factory: () => new ServiceB()});
      const Comp = generateComponent({providers: [provider], pipes: [generatePipe(provider)]});
      const fixture = new ComponentFixture(Comp);
      expect(fixture.html).toEqual('MyComponent Title - ServiceB Title');
    });

    it('should be able to handle Module injection', () => {
      const injector = createInjector(ModuleA);
      const Comp = generateComponent({providers: [], pipes: [generatePipe(ServiceA)]});
      const fixture = new ComponentFixture(Comp, {injector});
      expect(fixture.html).toEqual('MyComponent Title - ServiceA Title');
    });

  });

  describe('WrappedValue', () => {
    @Pipe({name: 'wrappingPipe'})
    class WrappingPipe implements PipeTransform {
      transform(value: any) { return new WrappedValue('Bar'); }

      static ngPipeDef = ΔdefinePipe({
        name: 'wrappingPipe',
        type: WrappingPipe,
        factory: function WrappingPipe_Factory() { return new WrappingPipe(); },
        pure: false
      });
    }

    function createTemplate() {
      Δtext(0);
      Δpipe(1, 'wrappingPipe');
    }

    function updateTemplate() { ΔtextBinding(0, Δinterpolation1('', ΔpipeBind1(1, 1, null), '')); }

    it('should unwrap', () => {
      const fixture =
          new TemplateFixture(createTemplate, updateTemplate, 2, 3, undefined, [WrappingPipe]);
      expect(fixture.html).toEqual('Bar');
    });

    it('should force change detection', () => {
      const fixture =
          new TemplateFixture(createTemplate, updateTemplate, 2, 3, undefined, [WrappingPipe]);
      expect(fixture.html).toEqual('Bar');

      fixture.hostElement.childNodes[0] !.textContent = 'Foo';
      expect(fixture.html).toEqual('Foo');

      fixture.update();
      expect(fixture.html).toEqual('Bar');
    });
  });

});

@Pipe({name: 'countingPipe'})
class CountingPipe implements PipeTransform {
  state: number = 0;

  transform(value: any) { return `${value} state:${this.state++}`; }

  static ngPipeDef = ΔdefinePipe({
    name: 'countingPipe',
    type: CountingPipe,
    factory: function CountingPipe_Factory() { return new CountingPipe(); },
  });
}

@Pipe({name: 'countingImpurePipe', pure: false})
class CountingImpurePipe implements PipeTransform {
  state: number = 0;

  transform(value: any) { return `${value} state:${this.state++}`; }

  static ngPipeDef = ΔdefinePipe({
    name: 'countingImpurePipe',
    type: CountingImpurePipe,
    factory: function CountingImpurePipe_Factory() { return new CountingImpurePipe(); },
    pure: false,
  });
}

@Pipe({name: 'multiArgPipe'})
class MultiArgPipe implements PipeTransform {
  transform(value: any, arg1: any, arg2: any, arg3 = 'default') {
    return `${value} ${arg1} ${arg2} ${arg3}`;
  }

  static ngPipeDef = ΔdefinePipe({
    name: 'multiArgPipe',
    type: MultiArgPipe,
    factory: function MultiArgPipe_Factory() { return new MultiArgPipe(); },
  });
}

@Pipe({name: 'duplicatePipe'})
class DuplicatePipe1 implements PipeTransform {
  transform(value: any) { return `${value} from duplicate 1`; }

  static ngPipeDef = ΔdefinePipe({
    name: 'duplicatePipe',
    type: DuplicatePipe1,
    factory: function DuplicatePipe1_Factory() { return new DuplicatePipe1(); },
  });
}

@Pipe({name: 'duplicatePipe'})
class DuplicatePipe2 implements PipeTransform {
  transform(value: any) { return `${value} from duplicate 2`; }

  static ngPipeDef = ΔdefinePipe({
    name: 'duplicatePipe',
    type: DuplicatePipe2,
    factory: function DuplicatePipe2_Factory() { return new DuplicatePipe2(); },
  });
}

class Person {
  // TODO(issue/24571): remove '!'.
  age !: number;
  // TODO(issue/24571): remove '!'.
  name !: string | null;
  address: Address|null = null;
  // TODO(issue/24571): remove '!'.
  phones !: number[];

  init(name: string|null, address: Address|null = null) {
    this.name = name;
    this.address = address;
  }

  sayHi(m: any): string { return `Hi, ${m}`; }

  passThrough(val: any): any { return val; }

  toString(): string {
    const address = this.address == null ? '' : ' address=' + this.address.toString();

    return 'name=' + this.name + address;
  }
}

class Address {
  cityGetterCalls: number = 0;
  zipCodeGetterCalls: number = 0;

  constructor(public _city: string, public _zipcode: any = null) {}

  get city() {
    this.cityGetterCalls++;
    return this._city;
  }

  get zipcode() {
    this.zipCodeGetterCalls++;
    return this._zipcode;
  }

  set city(v) { this._city = v; }

  set zipcode(v) { this._zipcode = v; }

  toString(): string { return this.city || '-'; }
}
