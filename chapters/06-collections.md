# Chapter 6: Collections - Arrays, Lists, Maps and Sets

> The workhorse data structures. Go has just arrays, slices and maps built into the language; Java ships a full Collections Framework; JS has arrays, objects, `Map` and `Set`; Python has `list`, `tuple`, `dict` and `set` with literal syntax.

## Overview

| Need | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Fixed-size sequence | array `[3]int` | array `int[]` | - | `tuple` (immutable) |
| Growable sequence | slice `[]int` | `ArrayList<Integer>` | `Array` | `list` |
| Key/value | `map[string]int` | `HashMap<String,Integer>` | `Map`, plain `Object` | `dict` |
| Unique values | `map[T]struct{}` (no set type) | `HashSet<T>` | `Set` | `set` |
| Immutable list | no | `List.of(...)` | `Object.freeze([..])` | `tuple` |
| Queue / deque | slice or channel | `ArrayDeque` | `Array` (`shift` is O(n)) | `collections.deque` |
| Sorted map | none in stdlib | `TreeMap` | none | none (sort keys) |
| Insertion ordered map | none (maps are unordered) | `LinkedHashMap` | `Map` (ordered) | `dict` (ordered since 3.7) |
| Literal syntax | `[]int{1,2,3}` | `List.of(1,2,3)` | `[1,2,3]` | `[1,2,3]` |
| Generics needed | yes (1.18+) | yes | no | no |

## Arrays and tuples

```go
var a [3]int                 // [0 0 0] - the size is part of the TYPE
b := [3]int{1, 2, 3}
c := [...]int{1, 2, 3, 4}    // compiler counts
d := b                       // arrays are VALUES: d is a full copy
```

```java
int[] a = new int[3];        // [0, 0, 0], length fixed at creation
int[] b = {1, 2, 3};
int[][] grid = new int[3][4];
a.length;                    // field, not a method
```

```js
// JavaScript has no fixed arrays; Array is dynamic. Typed arrays exist for binary data:
const bytes = new Uint8Array(4);
```

```python
point = (3, 4)               # tuple: immutable, hashable (usable as dict key)
x, y = point
single = (5,)                # the comma makes the tuple
```

Go arrays are rarely used directly; slices are the norm.

## Lists and slices

```go
nums := []int{1, 2, 3}
nums = append(nums, 4, 5)           // append RETURNS a possibly new slice
nums[0] = 99
fmt.Println(len(nums), cap(nums))
sub := nums[1:3]                    // [2 3] - SHARES memory with nums!
copySlice := slices.Clone(nums)     // Go 1.21+ "slices" package
nums = slices.Delete(nums, 1, 2)    // remove index 1
make([]int, 0, 10)                  // length 0, capacity 10
```

```java
List<Integer> nums = new ArrayList<>(List.of(1, 2, 3));
nums.add(4);
nums.set(0, 99);
nums.get(1);
nums.size();
nums.remove(Integer.valueOf(2));    // remove(int) removes by INDEX - overload trap
List<Integer> sub = nums.subList(1, 3);   // a view, not a copy
List<Integer> fixed = List.of(1, 2);      // immutable: add() throws UnsupportedOperationException
```

```js
const nums = [1, 2, 3];
nums.push(4);
nums[0] = 99;
nums.length;
nums.at(-1);                        // last element
nums.splice(1, 1);                  // remove index 1 (mutates)
const sub = nums.slice(1, 3);       // copy
const copy = [...nums];             // shallow copy
```

```python
nums = [1, 2, 3]
nums.append(4)
nums[0] = 99
nums[-1]                            # last element
len(nums)
del nums[1]                         # or nums.pop(1)
sub = nums[1:3]                     # a copy
copy = nums.copy()                  # or nums[:] or list(nums)
```

### Slice internals (Go)

A slice is a small struct `{pointer, length, capacity}` pointing into an array. `append` writes in place when capacity allows, otherwise allocates a bigger array and copies. Hence:

```go
a := []int{1, 2, 3, 4}
b := a[:2]
b = append(b, 100)      // overwrites a[2]!  a is now [1 2 100 4]
```

Two slices can alias the same data; always use the result of `append`, and `slices.Clone` when you need independence.

## Common list operations

| Task | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Add to end | `s = append(s, x)` | `l.add(x)` | `a.push(x)` | `l.append(x)` |
| Insert at i | `slices.Insert(s, i, x)` | `l.add(i, x)` | `a.splice(i, 0, x)` | `l.insert(i, x)` |
| Remove by index | `slices.Delete(s, i, i+1)` | `l.remove(i)` | `a.splice(i, 1)` | `del l[i]` / `l.pop(i)` |
| Contains | `slices.Contains(s, x)` | `l.contains(x)` | `a.includes(x)` | `x in l` |
| Index of | `slices.Index(s, x)` | `l.indexOf(x)` | `a.indexOf(x)` | `l.index(x)` (raises) |
| Reverse in place | `slices.Reverse(s)` | `Collections.reverse(l)` | `a.reverse()` | `l.reverse()` |
| Sort in place | `slices.Sort(s)` | `Collections.sort(l)` / `l.sort(null)` | `a.sort((x,y)=>x-y)` | `l.sort()` |
| Sorted copy | clone then sort | `l.stream().sorted().toList()` | `a.toSorted()` (ES2023) | `sorted(l)` |
| Min / Max | `slices.Min(s)` | `Collections.min(l)` | `Math.min(...a)` | `min(l)` |
| Sum | loop | `stream().mapToInt(..).sum()` | `a.reduce((s,x)=>s+x, 0)` | `sum(l)` |

JS gotcha: `[10, 9, 1].sort()` sorts **as strings** by default -> `[1, 10, 9]`. Always pass a comparator for numbers.

## Transforming: map / filter / reduce

```go
// No built-ins: write the loop. This is idiomatic Go.
var evens []int
for _, n := range nums {
    if n%2 == 0 { evens = append(evens, n*n) }
}
```

```java
List<Integer> evens = nums.stream()
    .filter(n -> n % 2 == 0)
    .map(n -> n * n)
    .toList();                         // Java 16+
int total = nums.stream().mapToInt(Integer::intValue).sum();
```

```js
const evens = nums.filter((n) => n % 2 === 0).map((n) => n * n);
const total = nums.reduce((acc, n) => acc + n, 0);
```

```python
evens = [n * n for n in nums if n % 2 == 0]       # list comprehension
total = sum(nums)
squares = {n: n * n for n in nums}                 # dict comprehension
unique = {n % 3 for n in nums}                     # set comprehension
lazy = (n * n for n in nums)                       # generator expression
```

Style spectrum: Go = explicit loops; Java = streams; JS = chained array methods; Python = comprehensions.

## Maps / dictionaries

```go
ages := map[string]int{"ada": 36, "linus": 54}
ages["grace"] = 85
v := ages["missing"]                // 0 - the ZERO VALUE, not an error
v, ok := ages["missing"]            // comma-ok idiom: ok == false
delete(ages, "ada")
len(ages)
for k, v := range ages { }          // order is random
var m map[string]int                // nil map: reading is fine, WRITING PANICS
m = make(map[string]int)
```

```java
Map<String, Integer> ages = new HashMap<>();
ages.put("ada", 36);
ages.get("missing");                // null
ages.getOrDefault("missing", 0);
ages.containsKey("ada");
ages.remove("ada");
ages.merge("ada", 1, Integer::sum);          // counter idiom
ages.computeIfAbsent("x", k -> 0);
Map<String, Integer> fixed = Map.of("a", 1, "b", 2);   // immutable
for (Map.Entry<String, Integer> e : ages.entrySet()) { }
```

```js
const ages = new Map([["ada", 36], ["linus", 54]]);
ages.set("grace", 85);
ages.get("missing");                 // undefined
ages.has("ada");
ages.delete("ada");
ages.size;
for (const [k, v] of ages) { }       // insertion order

const obj = { ada: 36 };             // plain object: also used as a dictionary
obj["grace"] = 85;
"ada" in obj;
Object.keys(obj); Object.entries(obj);
```

```python
ages = {"ada": 36, "linus": 54}
ages["grace"] = 85
ages["missing"]                      # KeyError
ages.get("missing", 0)               # default
"ada" in ages
del ages["ada"]
len(ages)
for k, v in ages.items(): ...
from collections import Counter, defaultdict
Counter("banana")                    # Counter({'a': 3, 'n': 2, 'b': 1})
groups = defaultdict(list)
groups["x"].append(1)
```

Key requirements:

- **Go** keys must be comparable (`==`): strings, numbers, bools, arrays, structs of those. Not slices or maps.
- **Java** keys need correct `equals` and `hashCode`.
- **Python** keys must be hashable (immutable): strings, numbers, tuples - not lists.
- **JS** `Map` accepts any key; plain objects convert keys to strings (or Symbols). Prefer `Map` when keys are not fixed identifiers.

Map concurrency: Go maps and Java `HashMap` are **not** thread-safe (Go may crash with "concurrent map writes"; use `sync.Mutex`, `sync.Map` or `ConcurrentHashMap`).

## Sets

```go
seen := map[string]struct{}{}        // struct{} takes zero bytes
seen["a"] = struct{}{}
if _, ok := seen["a"]; ok { }
// or map[string]bool for brevity
```

```java
Set<String> seen = new HashSet<>();
seen.add("a");
seen.contains("a");
Set<String> both = new HashSet<>(a); both.retainAll(b);     // intersection
```

```js
const seen = new Set(["a", "b"]);
seen.add("c"); seen.has("a"); seen.delete("b");
[...new Set([1, 1, 2])];             // de-duplicate -> [1, 2]
// ES2025 added union/intersection/difference methods on Set; check your Node version.
```

```python
seen = {"a", "b"}                    # note: {} alone is an empty DICT; use set()
seen.add("c")
a | b; a & b; a - b; a ^ b           # union, intersection, difference, symmetric difference
```

Python sets have first-class set algebra; Go has no set type at all.

## Sorting with custom order

```go
people := []Person{{"Ada", 36}, {"Linus", 54}}
slices.SortFunc(people, func(a, b Person) int {
    return cmp.Compare(a.Age, b.Age)          // import "cmp"
})
```

```java
people.sort(Comparator.comparingInt(Person::age).thenComparing(Person::name));
```

```js
people.sort((a, b) => a.age - b.age || a.name.localeCompare(b.name));
```

```python
people.sort(key=lambda p: (p.age, p.name))     # key function, not comparator
sorted(people, key=lambda p: p.age, reverse=True)
```

Python and Java build sorts from "key extractors"; Go and JS use comparators returning negative/zero/positive. All four sorts are stable except Go's `sort.Slice` / `slices.Sort` (use `slices.SortStableFunc` if you need stability).

## Copying: shallow vs deep

| | Shallow copy | Deep copy |
| --- | --- | --- |
| Go | `slices.Clone`, `maps.Clone` | write it yourself (or serialise) |
| Java | `new ArrayList<>(list)` | copy constructors / serialisation |
| JavaScript | `[...a]`, `{...o}` | `structuredClone(x)` |
| Python | `list.copy()`, `copy.copy` | `copy.deepcopy` |

Assignment never copies a collection in Java, JS or Python (both names refer to one object). In Go, assigning an array copies it, but assigning a slice or map copies only the header.

## Quirks and gotchas

- **Go**: nil slices are valid and `append`-able; nil maps panic on write. Iterating a map while mutating it is allowed but unpredictable.
- **Java**: `List.of`/`Map.of` are immutable and reject `null`; `Arrays.asList` is fixed-size but writable-through-to-the-array; modifying a list during for-each throws `ConcurrentModificationException`.
- **JavaScript**: `delete a[1]` leaves a hole instead of shifting; `typeof []` is `"object"` (use `Array.isArray`); `a.length = 0` truncates in place.
- **Python**: `[[0]*3]*3` makes three references to the SAME row; negative indices wrap, slices never raise but plain indices do.

## What is idiomatic

- **Go**: preallocate with `make([]T, 0, n)` when size is known; use `slices` and `maps` packages (1.21+); comma-ok for map lookups.
- **Java**: program to interfaces (`List`, `Map`), use immutable factories, streams for pipelines, `record` as map values.
- **JavaScript**: array methods over loops, `Map`/`Set` for non-trivial keys, spread for immutable updates.
- **Python**: comprehensions, `in`, `enumerate`, `dict.get`, `Counter`/`defaultdict`, tuples for fixed records.

## Checklist

- [ ] I can create, index, append to and iterate a list in each language
- [ ] I understand Go slice length vs capacity and why `append` must be reassigned
- [ ] I can use maps with defaults and check for missing keys in each language
- [ ] I can model a set in each language (including Go's `map[T]struct{}`)
- [ ] I can sort by a custom key/comparator in each language
- [ ] I can write map/filter/reduce in each language's idiomatic style
- [ ] I know the shallow vs deep copy tools of each language
- [ ] I know what can be a map key in each language

## Exercises

In each language:

1. Given a list of integers, produce a list of the squares of the even ones.
2. Given a list of words, build a map from first letter to list of words starting with it.
3. Given two lists, compute their intersection and the elements unique to each, using a set.
4. Sort a list of `{name, age}` records by age descending then name ascending.
5. Write `chunk(list, n)` that splits a list into pieces of size n (the last may be shorter). In Go, make sure modifying one chunk does not alter the original.

Then revisit the chapter 3 exercise (`wordFrequencies`) and finish it with a proper map/dict.
