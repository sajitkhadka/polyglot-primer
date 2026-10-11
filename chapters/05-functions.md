# Chapter 5: Functions

> Declaring, calling and passing functions. Go returns multiple values and uses them for errors; JS and Python treat functions as ordinary values with rich argument handling; Java wraps everything in methods and offers overloads instead of default arguments.

## Overview

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Free-standing functions | yes | **no** - always inside a class (static methods) | yes | yes |
| Multiple return values | **yes** (native) | no (use a record/array) | no (return array/object, destructure) | yes (really a tuple) |
| Default parameters | no | no (use overloads) | yes | yes |
| Named arguments | no | no | no (pass an object) | **yes** |
| Overloading | no | **yes** | no | no |
| Variadic | `...T` | `T...` | `...rest` | `*args` |
| First-class functions | yes | via lambdas / functional interfaces | yes | yes |
| Closures | yes | yes (captured vars must be effectively final) | yes | yes |
| Nested functions | closures only (anonymous) | lambdas / local classes | yes | yes |

## Declaring and calling

```go
func add(a int, b int) int {       // or: func add(a, b int) int
    return a + b
}
total := add(2, 3)
```

```java
public static int add(int a, int b) {
    return a + b;
}
int total = add(2, 3);
```

```js
function add(a, b) {
  return a + b;
}
const addArrow = (a, b) => a + b;      // arrow function, implicit return
const total = add(2, 3);
```

```python
def add(a, b):
    return a + b

add_lambda = lambda a, b: a + b         # single expression only
total = add(2, 3)
```

Type position: Go puts the type **after** the name; Java before. Python can annotate: `def add(a: int, b: int) -> int:`.

Missing arguments: Go and Java refuse to compile; JS silently passes `undefined` and ignores extras; Python raises `TypeError`.

## Multiple return values

```go
func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, errors.New("divide by zero")
    }
    return a / b, nil
}

result, err := divide(10, 2)
_, err = divide(1, 0)                   // blank identifier discards a value
```

```java
record Result(double value, String error) {}      // records: Java 16+
Result divide(double a, double b) {
    return b == 0 ? new Result(0, "divide by zero") : new Result(a / b, null);
}
```

```js
function divide(a, b) {
  return [a / b, null];                  // or return { value, error }
}
const [result, err] = divide(10, 2);     // destructuring
```

```python
def divide(a, b):
    return a / b, None                   # a tuple
result, err = divide(10, 2)              # unpacking
```

Go's `(value, error)` pair is the backbone of its error handling (see the errors chapter). In the other languages exceptions are used instead.

## Named return values (Go)

```go
func minMax(xs []int) (min, max int) {   // named results start as zero values
    min, max = xs[0], xs[0]
    for _, x := range xs {
        if x < min { min = x }
        if x > max { max = x }
    }
    return                                // "naked" return: fine in short functions only
}
```

Named results also let `defer` modify the return value, a Go-only trick covered in the Go-specific chapter.

## Default, optional and named arguments

```go
// Go has none. Use an options struct or functional options.
type Options struct{ Retries int; Verbose bool }
func run(o Options) {}
run(Options{Retries: 3})
```

```java
// Java: overloads
void greet(String name) { greet(name, "Hello"); }
void greet(String name, String greeting) { /* ... */ }
```

```js
function greet(name, greeting = "Hello") {}      // default parameter
function connect({ host, port = 80 } = {}) {}     // destructured "named" args
connect({ host: "x" });
```

```python
def greet(name, greeting="Hello", *, shout=False):    # `*` forces keyword-only
    ...
greet("Ada", shout=True)                              # named arguments
```

Python gotcha - **mutable default arguments are shared between calls**:

```python
def append(x, items=[]):        # BUG: one list for every call
    items.append(x); return items

def append(x, items=None):      # correct
    items = [] if items is None else items
```

## Variadic functions

```go
func sum(nums ...int) int {              // nums is a []int
    t := 0
    for _, n := range nums { t += n }
    return t
}
sum(1, 2, 3)
sum(xs...)                                // spread an existing slice
```

```java
static int sum(int... nums) {             // nums is an int[]
    int t = 0;
    for (int n : nums) t += n;
    return t;
}
sum(1, 2, 3);
```

```js
const sum = (...nums) => nums.reduce((a, b) => a + b, 0);
sum(1, 2, 3);
sum(...xs);                                // spread
```

```python
def total(*nums, **options):               # *args tuple, **kwargs dict
    return sum(nums)
total(1, 2, 3)
total(*xs, **opts)                         # unpack when calling
```

## Functions as values

```go
type Op func(int, int) int
ops := map[string]Op{
    "add": func(a, b int) int { return a + b },
    "mul": func(a, b int) int { return a * b },
}
fmt.Println(ops["add"](2, 3))
```

```java
import java.util.function.*;
BiFunction<Integer, Integer, Integer> add = (a, b) -> a + b;
Function<Integer, Integer> square = x -> x * x;
Supplier<String> hello = () -> "hi";
add.apply(2, 3);
```

```js
const ops = { add: (a, b) => a + b, mul: (a, b) => a * b };
ops.add(2, 3);
[1, 2, 3].map((x) => x * 2);
```

```python
ops = {"add": lambda a, b: a + b, "mul": lambda a, b: a * b}
ops["add"](2, 3)
list(map(lambda x: x * 2, [1, 2, 3]))      # comprehension is more idiomatic
```

Java has no function types; every lambda targets a **functional interface** (`Function`, `Predicate`, `Supplier`, `Consumer`, `Runnable`, ...). That is why you call `.apply()` instead of `f(x)`.

## Closures

```go
func counter() func() int {
    n := 0
    return func() int { n++; return n }
}
c := counter()
c(); c()          // 1, 2
```

```java
// captured locals must be final or effectively final
int[] n = {0};
Supplier<Integer> next = () -> ++n[0];       // workaround: a 1-element array or AtomicInteger
```

```js
function counter() {
  let n = 0;
  return () => ++n;
}
```

```python
def counter():
    n = 0
    def inc():
        nonlocal n          # required to REBIND an outer variable
        n += 1
        return n
    return inc
```

Python needs `nonlocal`; without it `n += 1` makes `n` a local and raises `UnboundLocalError`. Java forbids reassigning captured variables altogether.

## `this`, receivers and methods

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Instance reference | explicit receiver: `func (u User) Name()` | implicit `this` | `this` (depends on how it's called!) | explicit first param `self` |
| Binding of `this` | fixed | fixed | **dynamic** except in arrow functions | fixed (bound method) |

JavaScript quirk: `const f = obj.method; f()` loses `this`. Arrow functions capture `this` lexically, which is why they are used for callbacks. Full coverage in the classes/structs chapter.

## Recursion

```go
func fact(n int) int {
    if n <= 1 { return 1 }
    return n * fact(n-1)
}
```

All four recurse the same way. Limits differ: Go stacks grow dynamically (up to 1 GB by default) so deep recursion is usually fine; Java defaults to a small thread stack (`StackOverflowError` near 10-20k frames); JS throws `RangeError` around 10k frames; Python raises `RecursionError` at 1000 frames by default (`sys.setrecursionlimit`). **None of them guarantees tail-call optimisation.**

## Passing semantics: value, reference, copy

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Model | **always by value** (a copy) | always by value (of the reference for objects) | by value of the reference | by "assignment" (object reference) |
| Mutate caller's data | only via pointer, slice, map | mutate the object | mutate the object | mutate the object |

- Go copies structs and arrays when passed; slices, maps and channels are small headers that point at shared data. Use a pointer (`*T`) to mutate a struct.
- Java, JS and Python pass a reference *by value*: you can mutate the object it points at, but reassigning the parameter doesn't affect the caller.

```python
def f(lst):
    lst.append(1)      # caller sees this
    lst = [99]         # caller does NOT see this
```

## Quirks and gotchas

- **Go**: functions can't be overloaded or have default values; unused parameters are fine but unused results of some calls are linted.
- **Java**: overload resolution can surprise you (boxing vs widening vs varargs); methods can't be declared outside classes.
- **JavaScript**: function declarations are **hoisted** (callable before they appear), arrow functions and `const f = function(){}` are not; extra arguments are ignored; `arguments` exists in non-arrow functions but use rest parameters instead.
- **Python**: mutable default arguments, `lambda` limited to one expression, and functions are objects with attributes (`f.calls = 0` works).

## What is idiomatic

- **Go**: return `(T, error)`; accept interfaces, return structs; keep functions short; use `defer` for cleanup; functional options for configuration.
- **Java**: small static helpers in utility classes, overloads for convenience, lambdas with the `java.util.function` types, records to return grouped values.
- **JavaScript**: arrow functions for callbacks, destructured parameter objects for many options, pure functions where possible.
- **Python**: type-hinted signatures, keyword arguments for clarity, generators over building big lists, decorators for cross-cutting behaviour.

## Checklist

- [ ] I can declare and call a function in each language
- [ ] I can return and receive multiple values in Go, Python and JS
- [ ] I know Java uses overloads and records where others use defaults and tuples
- [ ] I can write default, keyword-only and variadic parameters
- [ ] I can store a function in a variable and pass it to another function in each language
- [ ] I understand closures and what each language requires to modify a captured variable
- [ ] I know what is copied and what is shared when passing arguments
- [ ] I know the recursion limit story of each language

## Exercises

In each language implement:

1. `divmod(a, b)` returning quotient and remainder, with an error/exception for division by zero.
2. `apply(xs, f)` returning a new collection with `f` applied to each element (without using the built-in `map`).
3. `makeMultiplier(n)` returning a function that multiplies its input by `n`.
4. `sumAll(...)` that accepts any number of arguments.
5. A `memoize(f)` wrapper that caches results by argument. (Python: also try `functools.cache`.)

Predict, then verify: what does `append(1)` print when called twice with the mutable-default Python bug above?
