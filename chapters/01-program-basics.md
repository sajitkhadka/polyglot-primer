# Chapter 1: Program Basics

> Hello world, how each language runs code, where `main` lives, comments, and the naming/formatting culture of each. Versions assumed: Go 1.22+, Java 21, JavaScript (ES2023 on Node 22), Python 3.12.

## The big picture

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Typing | Static, inferred locally | Static, mostly explicit (`var` for locals) | Dynamic | Dynamic (optional type hints) |
| Execution | Compiled to a native binary | Compiled to bytecode, run on the JVM (JIT) | Interpreted/JIT by an engine (V8) | Interpreted bytecode (CPython) |
| Paradigm | Procedural + structs + interfaces | Class-based OO (+ functional features) | Multi-paradigm, prototype-based OO | Multi-paradigm, class-based OO |
| Memory | Garbage collected | Garbage collected | Garbage collected | Ref counting + cycle GC |
| Blocks | `{ }` | `{ }` | `{ }` | Indentation |
| Statement end | Newline (auto `;`) | `;` required | `;` optional (ASI) | Newline |
| Standard runtime | Single static binary | JRE/JDK | Node.js or a browser | Python interpreter |

The one-line mental model: Go and Java check your program **before** it runs; JavaScript and Python find out **while** it runs.

## Hello, World

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, World")
}
```

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World");
    }
}
```

```js
console.log("Hello, World");
```

```python
print("Hello, World")
```

Notice the ceremony gradient: Python and JS need one line; Go needs a package, an import and a function; Java needs a class, a method and modifiers. (Java 21 has a *preview* of unnamed classes and instance `main` that shrinks this, but production code still uses the classic form.)

## Running code

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Run directly | `go run main.go` | `java Main.java` (single-file source launch) | `node main.js` | `python main.py` |
| Build | `go build` -> binary | `javac Main.java` -> `Main.class` | none | none (imported modules are cached as `.pyc`) |
| Run built | `./main` | `java Main` | n/a | n/a |
| REPL | none built in | `jshell` | `node` | `python` |
| Package a deliverable | the binary itself | a `.jar` | usually a folder + `package.json` | a folder / wheel |

Quirk: `go run` compiles to a temp dir and runs it - it is not interpreted. Go compile times are very fast by design.

## The entry point

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Entry | `func main()` in `package main` | `public static void main(String[] args)` | top of the file; runs top-to-bottom | top of the file; runs top-to-bottom |
| Command-line args | `os.Args` (index 0 = program) | `args` parameter (no program name) | `process.argv` (0 = node, 1 = script) | `sys.argv` (0 = script) |
| Exit code | `os.Exit(1)` | `System.exit(1)` | `process.exit(1)` | `sys.exit(1)` |

Python idiom - guard the entry so a file is importable without running:

```python
def main():
    print("running")

if __name__ == "__main__":
    main()
```

JavaScript has no `main`; ES modules and CommonJS simply execute top-level code. Older Node versions have no portable equivalent of the Python guard, so scripts simply run top-level.

## Comments

```go
// line comment
/* block comment */
// Doc comments are plain comments placed directly above a declaration:
// Add returns a+b.
func Add(a, b int) int { return a + b }
```

```java
// line comment
/* block comment */
/** Javadoc: rendered by the javadoc tool. */
```

```js
// line comment
/* block comment */
/** JSDoc: editors use this for hints */
```

```python
# line comment
"""Docstring: a string literal as the first statement of a
module, class or function. Stored in __doc__ and used by help()."""
```

Python has no block comment; people use consecutive `#` lines. Docstrings are real runtime objects, not comments.

## Naming conventions

| Thing | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Variables / functions | `camelCase` | `camelCase` | `camelCase` | `snake_case` |
| Types / classes | `PascalCase` | `PascalCase` | `PascalCase` | `PascalCase` |
| Constants | `PascalCase` or `camelCase` | `UPPER_SNAKE` | `UPPER_SNAKE` or `camelCase` | `UPPER_SNAKE` |
| Packages / modules | short lowercase, no underscores | `lowercase.dotted` | file names `kebab-case` or `camelCase` | `lowercase_with_underscores` |
| Visibility | **Capital first letter = exported** | `public`/`private` keywords | `#private` fields, `export` | `_leading` underscore = "please don't" (convention only) |

The Go rule is the one to burn in: `Println` is public, `println` is package-private. There is no `public` keyword.

## Formatting and tooling

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Formatter | `gofmt` (built in, no options, universal) | google-java-format / IDE | Prettier (third party, de facto) | `black` / `ruff format` (third party) |
| Indentation | Tabs | 4 spaces | 2 spaces (common) | 4 spaces (PEP 8) |
| Style guide | Effective Go | Google / Oracle | Airbnb / StandardJS (not official) | PEP 8 (official) |

Go ends style debates by shipping the formatter in the toolchain. Python makes indentation part of the grammar - mixing tabs and spaces is a `TabError`.

## Program organization

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Unit of code | package (a directory) | class inside a package | module (a file) | module (a file) |
| One public thing per file? | No | Yes: public class name = file name | No | No |
| Imports | `import "fmt"` | `import java.util.List;` | `import fs from "node:fs"` | `import os` / `from os import path` |
| Unused import | **Compile error** | warning | fine | fine |
| Unused local variable | **Compile error** | warning | fine | fine |

Go's compile errors on unused imports and variables annoy newcomers and then become a feature: dead code can't accumulate.

## Quirks and gotchas

- **Go**: the opening brace must be on the same line as `func`/`if`/`for`; the auto-inserted semicolon will break it otherwise.
- **Java**: file name must match the public class. `main` must be exactly `public static void main(String[])`.
- **JavaScript**: semicolons are optional because of Automatic Semicolon Insertion, but `return` followed by a newline returns `undefined`. Pick a style and let a formatter enforce it.
- **Python**: indentation is syntax. An editor that converts tabs silently can change meaning.
- **JavaScript** has two module systems: CommonJS (`require`) and ES Modules (`import`). Use ES modules in new code (`"type": "module"` in `package.json` or `.mjs`).

## What is idiomatic

- **Go**: small `main` that wires things up; run `gofmt` on save; handle every error; short names in short scopes (`i`, `r`, `buf`).
- **Java**: one class per file, descriptive names, packages mirror directories, rely on the IDE for boilerplate.
- **JavaScript**: `const` by default, ES modules, no semicolon wars - format automatically.
- **Python**: "There should be one obvious way to do it" (`import this`). Follow PEP 8, use the `if __name__ == "__main__"` guard.

## Checklist

- [ ] I can write, compile and run Hello World in all four languages
- [ ] I know which languages are compiled, which are interpreted, and what the JVM sits in between
- [ ] I know where execution starts in each language
- [ ] I can read command-line arguments in each language
- [ ] I know the naming convention and visibility rule of each language
- [ ] I know which formatter/style guide belongs to each

## Exercises

Write a program in **each** of the four languages that:

1. Reads a name from the command-line arguments (default to `"World"` if none is given) and prints `Hello, <name>!`.
2. Prints how many arguments were passed.
3. Exits with status code `2` if more than three arguments are given (check with `echo $?` or `$LASTEXITCODE`).
4. Has a doc comment on the function that builds the greeting.

Stretch: make the greeting function importable from another file without running the program (Python guard, Go separate package, JS `export`, Java separate class).
