# Chapter 4: Control Flow

> Branching and looping. Go has the fewest keywords (one loop, `for`); Java and JavaScript have the most (`for`, `while`, `do/while`, enhanced `for`); Python has `for`/`while` plus an `else` clause on loops.

## Overview

| Construct | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| if / else | yes | yes | yes | `if / elif / else` |
| Condition parentheses | none | required | required | none |
| Braces required | **always** | optional (don't skip) | optional (don't skip) | indentation |
| Loop keywords | `for` only | `for`, `while`, `do-while`, for-each | `for`, `while`, `do-while`, `for...of`, `for...in` | `for`, `while` |
| switch | expression-less or value switch, no fallthrough | `switch` statement and expression | `switch` (strict equality, falls through) | `match` (3.10+, structural) |
| Ternary | none | `? :` | `? :` | `x if c else y` |
| goto / labels | `goto` and labels | labelled `break`/`continue` | labelled `break`/`continue` | none |

## if / else

```go
if x > 10 {
    fmt.Println("big")
} else if x > 5 {
    fmt.Println("medium")
} else {
    fmt.Println("small")
}

// init statement scoped to the if (very idiomatic)
if err := doThing(); err != nil {
    return err
}
```

```java
if (x > 10) {
    System.out.println("big");
} else if (x > 5) {
    System.out.println("medium");
} else {
    System.out.println("small");
}
```

```js
if (x > 10) {
  console.log("big");
} else if (x > 5) {
  console.log("medium");
} else {
  console.log("small");
}
```

```python
if x > 10:
    print("big")
elif x > 5:
    print("medium")
else:
    print("small")
```

Go quirk: the `else` must be on the same line as the closing `}`. The init statement (`if v, ok := m[k]; ok {`) limits variable scope to the `if` chain - use it constantly.

## Loops

### Counting loop

```go
for i := 0; i < 5; i++ {
    fmt.Println(i)
}
for i := range 5 {          // Go 1.22+: range over an integer
    fmt.Println(i)
}
```

```java
for (int i = 0; i < 5; i++) {
    System.out.println(i);
}
```

```js
for (let i = 0; i < 5; i++) {
  console.log(i);
}
```

```python
for i in range(5):          # 0..4
    print(i)
for i in range(2, 10, 3):   # start, stop (exclusive), step -> 2, 5, 8
    print(i)
```

### While-style loop

```go
for n > 0 {                 // Go's "while"
    n /= 2
}
for {                       // infinite loop; exit with break/return
    if done() { break }
}
```

```java
while (n > 0) { n /= 2; }
do { n++; } while (n < 10);       // body runs at least once
```

```js
while (n > 0) { n = Math.floor(n / 2); }
do { n++; } while (n < 10);
```

```python
while n > 0:
    n //= 2
# no do-while; use `while True:` with a break
```

### Iterating collections

```go
nums := []int{10, 20, 30}
for i, v := range nums { fmt.Println(i, v) }
for _, v := range nums { fmt.Println(v) }       // _ discards the index
for k, v := range someMap { }                   // random order!
```

```java
for (int v : nums) { }                          // for-each over arrays/Iterables
for (var e : map.entrySet()) { e.getKey(); e.getValue(); }
```

```js
for (const v of nums) { }                       // values of any iterable
for (const [i, v] of nums.entries()) { }        // index + value
for (const key in obj) { }                      // KEYS of an object - avoid on arrays
nums.forEach((v, i) => { });                    // cannot break out of this
```

```python
for v in nums: ...
for i, v in enumerate(nums): ...
for k, v in some_dict.items(): ...
for a, b in zip(xs, ys): ...                    # parallel iteration
```

Key differences:

- JS `for...in` iterates property **names** (including inherited ones) - use `for...of` for values.
- Go `range` over a map is deliberately randomised each run; sort the keys if order matters.
- Python `enumerate` and `zip` replace manual index bookkeeping.
- Go 1.22 changed `for` loop variables to be **per-iteration**; earlier versions shared one variable, which broke closures and goroutines. JS `let` always had per-iteration bindings.

## break, continue and labels

```go
outer:
for i := 0; i < 3; i++ {
    for j := 0; j < 3; j++ {
        if j == 2 { continue outer }
        if i == 2 { break outer }
    }
}
```

```java
outer:
for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
        if (j == 2) continue outer;
        if (i == 2) break outer;
    }
}
```

```js
outer: for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    if (j === 2) continue outer;
    if (i === 2) break outer;
  }
}
```

```python
# no labels. Extract a function and return, or use a flag / for-else.
```

## Loop else (Python only)

```python
for n in numbers:
    if n == target:
        print("found")
        break
else:
    print("not found")      # runs only if the loop finished without break
```

Handy, but many people find it confusing; a helper function that returns early is usually clearer.

## switch / match

```go
switch day {
case "sat", "sun":          // multiple values, no fallthrough by default
    fmt.Println("weekend")
case "fri":
    fmt.Println("almost")
    fallthrough             // explicit, rarely used
default:
    fmt.Println("weekday")
}

switch {                    // no tag: a cleaner if/else chain
case x < 0:
    fmt.Println("neg")
case x == 0:
    fmt.Println("zero")
default:
    fmt.Println("pos")
}

switch v := val.(type) {    // type switch
case int:    fmt.Println("int", v)
case string: fmt.Println("string", v)
}
```

```java
// Java 14+ switch expression: arrows, no fallthrough, must be exhaustive
String kind = switch (day) {
    case "sat", "sun" -> "weekend";
    case "fri" -> "almost";
    default -> "weekday";
};

// Java 21: pattern matching in switch
String describe(Object o) {
    return switch (o) {
        case Integer i when i > 10 -> "big int " + i;
        case Integer i -> "int " + i;
        case String s -> "string " + s;
        case null -> "null";
        default -> "other";
    };
}
```

```js
switch (day) {
  case "sat":
  case "sun":
    console.log("weekend");
    break;                  // forget this and execution FALLS THROUGH
  default:
    console.log("weekday");
}
// JS has no pattern matching; use if/else chains, lookup objects, or `switch (true)`.
```

```python
match command.split():                       # Python 3.10+
    case ["go", direction]:
        print("going", direction)
    case ["quit" | "exit"]:
        print("bye")
    case [x, y] if x == y:
        print("pair")
    case _:
        print("unknown")
```

Order of power: Python `match` (structural: unpacks sequences, dicts and classes) and Java 21 patterns (types, records) are the richest; Go's type switch covers type dispatch; JS `switch` is the most primitive and uses `===`.

## Ternary and conditional values

```go
// no ternary: use if/else with a variable
label := "odd"
if n%2 == 0 { label = "even" }
```

```java
String label = n % 2 == 0 ? "even" : "odd";
```

```js
const label = n % 2 === 0 ? "even" : "odd";
const name = user?.name ?? "anonymous";    // optional chaining + nullish coalescing
```

```python
label = "even" if n % 2 == 0 else "odd"
name = user.name if user else "anonymous"
x = a or "default"                           # `or` returns an operand, not a bool
```

## Early return and guard clauses

All four languages reward flat code over nested code:

```go
func process(u *User) error {
    if u == nil { return errors.New("nil user") }
    if !u.Active { return errors.New("inactive") }
    // happy path stays at the left margin
    return nil
}
```

The same guard-clause pattern is idiomatic in Java, JS and Python. Go enforces it culturally: `if err != nil { return err }` is everywhere.

## Quirks and gotchas

- **Go**: no parentheses around conditions, braces mandatory; there is no `while` or `do-while` keyword, and `switch` cases do not fall through.
- **Java**: missing braces cause the "dangling statement" bug; old-style `switch` with `:` falls through - prefer arrow form.
- **JavaScript**: `for (var i...)` with closures captures one shared `i`; `let` fixes it. `switch` uses `===`, so `case "1"` won't match the number `1`.
- **Python**: `range(5)` is a lazy sequence, not a list; the loop variable leaks out of the loop after it ends; there's no `switch` before 3.10.

## What is idiomatic

- **Go**: one `for` keyword, `range` everywhere, `if err := ...; err != nil`, `switch` instead of `if` chains.
- **Java**: enhanced `for`, streams for transformation (chapter on collections), arrow `switch` expressions, pattern matching on sealed types.
- **JavaScript**: `for...of`, array methods (`map`, `filter`) for transformation, optional chaining, `??`.
- **Python**: iterate directly over things; never `for i in range(len(xs))` when `enumerate` will do; comprehensions for building lists.

## Checklist

- [ ] I can write `if/else` in each language, including Go's init statement
- [ ] I can write a counting loop, a while-style loop and a for-each loop in each language
- [ ] I know Go's single `for` covers all loop shapes
- [ ] I know the difference between JS `for...of` and `for...in`
- [ ] I can use labels with `break`/`continue` where supported
- [ ] I know what Python's loop `else` does
- [ ] I can use the modern switch/match forms in Java 21, Go and Python
- [ ] I know which `switch` falls through by default (JS, old-style Java)

## Exercises

Implement **FizzBuzz** (1 to 100) in each language, three ways:

1. Using a counting loop and `if/else`.
2. Using `switch` (Go tagless, Java arrow expression, JS `switch (true)`, Python `match`).
3. Using the most idiomatic collection-style iteration you can (Go range-over-int, Java `IntStream`, JS `Array.from`, Python comprehension).

Then write a function `firstDuplicate(nums)` that returns the first repeated number or "none", using a labelled break (Go/Java/JS) or Python's loop `else`.
