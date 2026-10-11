# Chapter 2: Variables, Constants and Types

> How to declare things, what the built-in types are, what "nothing" looks like, and how each language treats conversion, equality and operators.

## Declaring variables

```go
var count int = 10     // explicit
var name = "Ada"       // type inferred
age := 36              // short declaration (inside functions only)
var a, b = 1, 2        // multiple
x, y := 3.5, "hi"      // multiple, mixed types
```

```java
int count = 10;
var name = "Ada";            // Java 10+: local inference only, still statically typed
int a = 1, b = 2;
final int limit = 5;         // cannot be reassigned
```

```js
let count = 10;              // reassignable, block scoped
const name = "Ada";          // binding cannot be reassigned
var legacy = 1;              // function scoped, hoisted: avoid in new code
```

```python
count = 10                   # no keyword: assignment creates the name
name = "Ada"
a, b = 1, 2                  # tuple unpacking
a, b = b, a                  # swap, no temp variable
```

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Keyword | `var` or `:=` | type name or `var` | `let` / `const` | none |
| Re-typing allowed? | No | No | Yes | Yes (name can rebind to any type) |
| Scope | block | block | `let`/`const` block, `var` function | function / module / class (**no block scope**) |
| Unused local | compile error | warning | ok | ok |
| Redeclare in same scope | error (except `:=` with at least one new name) | error | `let`/`const` error, `var` ok | n/a (just rebinds) |

## Constants

```go
const Pi = 3.14159              // untyped constant: usable as int, float, etc. where it fits
const (
    Sunday = iota               // 0
    Monday                      // 1
    Tuesday                     // 2
)
```

```java
public static final double PI = 3.14159;   // class-level constant
```

```js
const PI = 3.14159;
Object.freeze(obj);              // shallow-freeze an object (const alone does not)
```

```python
PI = 3.14159                     # a convention only; nothing stops reassignment
from typing import Final
MAX: Final = 10                  # checkers (mypy) complain; runtime does not
```

Quirks:

- Go constants are evaluated at compile time and can be *untyped*, so `const x = 1 << 40` works until you force it into an `int32`.
- JS `const` protects the **binding**, not the value: `const a = []; a.push(1)` is fine.
- Python has no constants. `UPPER_CASE` is a promise between humans.
- Go uses `iota` where Java and Python use enums (see later chapters).

## Primitive and built-in types

| Concept | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Boolean | `bool` | `boolean` | `boolean` | `bool` |
| Small ints | `int8`, `int16`, `int32`, `int64` | `byte`, `short`, `int`, `long` | - | - |
| Default int | `int` (32 or 64 bit by platform) | `int` (32 bit) | `number` (64-bit float) | `int` (arbitrary precision) |
| Unsigned | `uint`, `uint8`...`uint64` | none (use `Integer.toUnsignedString` helpers) | - | - |
| Floats | `float32`, `float64` | `float`, `double` | `number` | `float` (64-bit) |
| Big integers | `math/big.Int` | `java.math.BigInteger` | `BigInt` (`123n`) | `int` (built in) |
| Exact decimals | none in stdlib (`big.Float`/`big.Rat`) | `BigDecimal` | none | `decimal.Decimal` (stdlib) |
| Character | `rune` (= `int32`, a Unicode code point), `byte` | `char` (16-bit UTF-16 unit) | string of length 1 | string of length 1 |
| Text | `string` (immutable bytes, UTF-8 by convention) | `String` (immutable, UTF-16) | `string` (immutable, UTF-16) | `str` (immutable, Unicode code points) |
| Complex | `complex128` | none | none | `complex` |
| Nothing | `nil` | `null` | `null` and `undefined` | `None` |

Highlights:

- **Python ints never overflow.** `2**1000` just works.
- **JS has one number type.** Integers are exact only up to `Number.MAX_SAFE_INTEGER` (2^53 - 1); use `BigInt` beyond that.
- **Java's wrapper types** (`Integer`, `Double`...) exist because generics can't hold primitives. They can be `null` and `==` compares references (see Equality).
- **Go's `int` is not `int64`.** They are distinct types that need explicit conversion.

## Zero values and defaults

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Uninitialised local | zero value (`0`, `""`, `false`, `nil`) | **compile error** (must assign) | `undefined` (with `let`) | `NameError` (name does not exist) |
| Uninitialised field | zero value | `0`, `false`, `null` | `undefined` | n/a (set in `__init__`) |

Go's "make the zero value useful" is a design principle: a `sync.Mutex` or `bytes.Buffer` works with no setup.

## Type inference and annotations

```go
x := 42            // int
y := 3.14          // float64
z := 'a'           // rune (int32), NOT byte or string
```

```java
var list = new ArrayList<String>();   // inferred, locals only
```

```js
// no annotations at runtime. TypeScript (third party) adds them.
```

```python
age: int = 36                          # hint only; Python never enforces it
def greet(name: str) -> str: ...
```

Python hints are for tools (mypy, IDEs). Passing the wrong type still runs until something breaks.

## Type conversion

```go
f := 3.9
i := int(f)              // 3, truncates; Go never converts implicitly
s := strconv.Itoa(42)    // "42"
n, err := strconv.Atoi("42")   // returns an error value if invalid
```

```java
double d = 3.9;
int i = (int) d;                      // 3, explicit cast required when narrowing
long big = i;                          // widening is implicit
String s = String.valueOf(42);
int n = Integer.parseInt("42");        // throws NumberFormatException
```

```js
Number("42");  parseInt("42px", 10);   // 42  (parseInt reads a prefix)
String(42);    (42).toString();
Number("abc"); // NaN, no exception
```

```python
int(3.9)         # 3, truncates toward zero
int("42")        # ValueError if invalid
str(42)
float("3.5")
```

Rule of thumb: Go and Java are strict (explicit conversions, errors on bad parses); JavaScript converts silently and gives `NaN`; Python converts only when you ask but raises exceptions on failure.

## Booleans and truthiness

| Value | Go `if` | Java `if` | JS `if` | Python `if` |
| --- | --- | --- | --- | --- |
| `0` | error (needs bool) | error | falsy | falsy |
| `""` | error | error | falsy | falsy |
| `nil` / `null` / `None` | error | error | falsy | falsy |
| empty list/array | error | error | **truthy** | falsy |
| empty object/map | error | error | **truthy** | falsy |
| `NaN` | n/a | n/a | falsy | truthy |

Go and Java require an actual boolean in a condition. JS and Python allow any value, but disagree about empty collections - a classic bug when porting code.

JS falsy list: `false`, `0`, `-0`, `0n`, `""`, `null`, `undefined`, `NaN`.

## Nothing: nil, null, undefined, None

- **Go** `nil` is typed: it applies to pointers, slices, maps, channels, functions and interfaces. Strings, ints and structs can never be nil.
- **Java** `null` can be assigned to any reference type. `NullPointerException` is the famous failure. `Optional<T>` is the library's answer for return values.
- **JavaScript** has two: `undefined` ("never set") and `null` ("set to nothing"). Reading a missing property or an unpassed argument gives `undefined`.
- **Python** `None` is a singleton object; compare with `is None`, never `== None`.

Go gotcha: an interface holding a nil pointer is **not** `== nil`. The interface has a type, so it is non-nil.

## Operators

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Arithmetic | `+ - * / %` | `+ - * / %` | `+ - * / % **` | `+ - * / // % **` |
| Integer division | `7 / 2 == 3` | `7 / 2 == 3` | no integer type: `Math.trunc(7/2)` | `7 // 2 == 3` (floors), `7 / 2 == 3.5` |
| Exponent | `math.Pow(a, b)` | `Math.pow(a, b)` | `a ** b` | `a ** b` |
| Increment | `i++` (statement only) | `i++`, `++i` (expressions) | `i++`, `++i` | `i += 1` (no `++`) |
| Logical | `&& \|\| !` | `&& \|\| !` | `&& \|\| !` and `??` | `and or not` |
| Ternary | none (use `if`) | `c ? a : b` | `c ? a : b` | `a if c else b` |
| Bitwise | `& \| ^ &^ << >>` | `& \| ^ ~ << >> >>>` | `& \| ^ ~ << >> >>>` (32-bit!) | `& \| ^ ~ << >>` |

Modulo of negatives differs: `-7 % 3` is `-1` in Go, Java and JS but `2` in Python (result takes the sign of the divisor).

Go has no ternary and no `++i`: `i++` is a statement, so `x = i++` is illegal. This is deliberate to keep expressions simple.

## Equality and comparison

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Value equality | `==` (for comparable types) | `.equals()` for objects, `==` for primitives | `===` (strict) | `==` |
| Identity | pointer comparison `p1 == p2` | `==` on references | `Object.is`, `===` on objects | `is` |
| Loose equality | none | none | `==` (coerces: `"1" == 1`) | none |

```js
0 == "";        // true   (avoid ==)
0 === "";       // false  (use ===)
NaN === NaN;    // false  (use Number.isNaN)
[] == false;    // true   (!)
```

```java
Integer a = 127, b = 127;  a == b;   // true  (cached small values)
Integer c = 1000, d = 1000; c == d;  // false (different objects!) - use equals
"hi" == new String("hi");            // false; use "hi".equals(...)
```

```python
[1, 2] == [1, 2]    # True  (value)
[1, 2] is [1, 2]    # False (different objects)
1 < x < 10          # chained comparison works
```

Go can compare structs and arrays with `==` if all fields are comparable; slices, maps and functions can only be compared to `nil`.

## Floating point

All four use IEEE 754 doubles: `0.1 + 0.2 != 0.3` everywhere. Use integers of cents or a decimal type for money (Java `BigDecimal`, Python `decimal`).

## Quirks and gotchas

- **Go**: `:=` can't be used outside functions; inside an `if`/`for` it creates a *new* variable that shadows the outer one - a classic bug with `err`.
- **Java**: integer overflow wraps silently (`Integer.MAX_VALUE + 1` is negative). `Math.addExact` throws instead.
- **JavaScript**: `typeof null === "object"` (a 1995 bug kept forever). `"5" + 3 === "53"` but `"5" - 3 === 2`.
- **Python**: defaults and rebinding are subtle - `a = b = []` makes both names point at the same list.

## What is idiomatic

- **Go**: use `:=` inside functions, `var x T` when you want the zero value, keep types small and explicit at API boundaries.
- **Java**: declare with the interface type (`List<String> xs = new ArrayList<>()`), use `var` for obvious long types, prefer `final` fields.
- **JavaScript**: `const` first, `let` only when reassigning, `===` always, `??` for defaults (not `||`, which swallows `0` and `""`).
- **Python**: no type needed on locals, annotate function signatures in larger code, `is None`, truthiness checks like `if items:`.

## Checklist

- [ ] I can declare variables and constants in each language and know their scoping rules
- [ ] I know the integer and float types of each language and their limits
- [ ] I understand zero values (Go), default values (Java), `undefined` (JS), and `NameError` (Python)
- [ ] I can convert between numbers and strings in each language and know how failures surface
- [ ] I know what is truthy/falsy in JS and Python, and that Go/Java need real booleans
- [ ] I know the difference between `==`, `===`, `.equals()` and `is`
- [ ] I know how `nil`, `null`, `undefined` and `None` differ

## Exercises

In each language:

1. Declare an integer, a float, a string, a boolean and a "nothing" value. Print each with its type (`%T`, `getClass()`, `typeof`, `type()`).
2. Parse the string `"42abc"` to an integer. Handle the failure appropriately in each language (error value, exception, `NaN`, `ValueError`).
3. Compute `0.1 + 0.2` and print it; then print the result of `7 / 2` and `-7 % 3`. Write down all four answers before running.
4. Overflow a 32-bit integer on purpose (not possible in Python - try `2**100` instead) and observe what happens.
5. Write a function `isEmpty(x)` that treats `0`, `""`, empty collections and nothing as "empty". Notice how much work that takes in Go/Java and how little in Python.
