# Contributing to AppyScript

Thanks for wanting to make robotics more accessible for kids!

---

## Ways to contribute

- **Report bugs** — open an issue, paste the `.appy` program that failed
- **Add hardware support** — write a new backend for your robot
- **Improve the runtime** — test and fix `applaa_robot.py` on real hardware
- **Add examples** — new `.appy` programs for the examples folder
- **Improve docs** — fix typos, add wiring diagrams, translate
- **Build tools** — IDE plugins, VS Code extension improvements

---

## Development setup

```bash
git clone https://github.com/rahulbachina/appyscript
cd appyscript
npm install
npm run build
npm test        # must be 85/85 before submitting a PR
```

---

## Adding a new hardware target

1. Create `src/backends/mytarget.ts` extending `BaseCodegen`
2. Register it in `src/compiler.ts`
3. Add a `HardwareProfile` in `src/plugins.ts`
4. Add tests in `src/test/compiler.test.ts`
5. Add runtime library in `runtime/mytarget/`
6. Update `docs/getting-started.md`

---

## Pull request rules

- All 85 tests must pass: `npm test`
- No TypeScript errors: `npx tsc --noEmit`
- New features need tests
- New backends need a runtime library
- Keep the language simple — AppyScript is for 8-year-olds and AI agents

---

## Code of conduct

Be kind. This project is for kids and educators.
