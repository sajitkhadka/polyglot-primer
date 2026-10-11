# Chapter 3: Strings and Text

> Strings are immutable in all four languages, but what a "character" is differs sharply: bytes (Go), UTF-16 units (Java, JS) or code points (Python).

## What a string is

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Type | `string` | `String` | `string` | `str` |
| Mutable? | No | No | No | No |
| Internal encoding | UTF-8 bytes | UTF-16 | UTF-16 | Unicode code points (flexible storage) |
| `len` measures | **bytes** | UTF-16 units (`length()`) | UTF-16 units (`.length`) | code points (`len(s)`) |
| Indexing `s[i]` | a **byte** | `s.charAt(i)` (a `char`) | one-unit string | one-code-point string |
| Quote styles | `"..."`, `` `raw` `` | `"..."`, `"""text block"""` | `'..'`, `".."`, `` `template` `` | `'..'`, `".."`, `'''..'''`, `r"raw"` |

Test with `"héllo"` (5 characters, `é` is 2 bytes in UTF-8): Go `len` gives 6; Java, JS and Python give 5. With an emoji like `"😀"`: Go 4, Java 2, JS 2, Python 1.

## Literals, multi-line and raw strings

```go
s := "tab\there"
raw := `C:\path\no\escapes
and multi-line`
```

```java
String s = "tab\there";
String block = """
    Hello
      indented text block (Java 15+)
    """;
```

```js
const s = "tab\there";
const multi = `line one
line two`;                     // template literal: multi-line allowed
const raw = String.raw`C:\path`;
```

```python
s = "tab\there"
multi = """line one
line two"""
raw = r"C:\path\no\escapes"
```

## Interpolation and formatting

```go
name, n := "Ada", 3
msg := fmt.Sprintf("%s has %d items (%.2f%%)", name, n, 12.5)
fmt.Println("plain", name, n)   // Println adds spaces between operands
```

```java
String msg = String.format("%s has %d items (%.2f%%)", name, n, 12.5);
String msg2 = "%s has %d items".formatted(name, n);   // Java 15+
// String templates (STR."...") are still preview features: don't rely on them.
```

```js
const msg = `${name} has ${n} items (${(12.5).toFixed(2)}%)`;
```

```python
msg = f"{name} has {n} items ({12.5:.2f}%)"      # f-string (3.6+)
msg2 = "{} has {} items".format(name, n)         # older style
```

Interpolation is first-class in JS and Python; Go and Java use `printf`-style verbs. Go verbs worth knowing: `%v` (any value), `%+v` (struct with field names), `%#v` (Go syntax), `%T` (type), `%q` (quoted), `%x` (hex).

## Concatenation

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Operator | `a + b` | `a + b` | `a + b` | `a + b` |
| Mixed with numbers | **error** | converts the number | converts the number | **TypeError** |
| Many pieces in a loop | `strings.Builder` | `StringBuilder` | `+=` is fine (engine optimises), or `array.join` | `"".join(parts)` |

Why builders: each `+=` on an immutable string copies it, making loops O(n^2). Java and Go need an explicit builder; Python's `"".join(list)` is the idiom.

## Common operations

| Task | Go (`strings`) | Java (`String`) | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Length | `len(s)` | `s.length()` | `s.length` | `len(s)` |
| Contains | `strings.Contains(s, x)` | `s.contains(x)` | `s.includes(x)` | `x in s` |
| Starts with | `strings.HasPrefix(s, x)` | `s.startsWith(x)` | `s.startsWith(x)` | `s.startswith(x)` |
| Ends with | `strings.HasSuffix(s, x)` | `s.endsWith(x)` | `s.endsWith(x)` | `s.endswith(x)` |
| Index of | `strings.Index(s, x)` (-1 if none) | `s.indexOf(x)` (-1) | `s.indexOf(x)` (-1) | `s.find(x)` (-1) or `s.index(x)` (raises) |
| Substring | `s[1:4]` (bytes) | `s.substring(1, 4)` | `s.slice(1, 4)` | `s[1:4]` |
| Upper / lower | `strings.ToUpper(s)` | `s.toUpperCase()` | `s.toUpperCase()` | `s.upper()` |
| Trim spaces | `strings.TrimSpace(s)` | `s.strip()` (or `trim()`) | `s.trim()` | `s.strip()` |
| Split | `strings.Split(s, ",")` | `s.split(",")` (regex!) | `s.split(",")` | `s.split(",")` |
| Join | `strings.Join(parts, ",")` | `String.join(",", parts)` | `parts.join(",")` | `",".join(parts)` |
| Replace all | `strings.ReplaceAll(s, a, b)` | `s.replace(a, b)` | `s.replaceAll(a, b)` | `s.replace(a, b)` |
| Repeat | `strings.Repeat(s, 3)` | `s.repeat(3)` | `s.repeat(3)` | `s * 3` |
| Reverse | loop over runes | `new StringBuilder(s).reverse()` | `[...s].reverse().join("")` | `s[::-1]` |
| Compare | `a == b`, `strings.Compare` | `a.equals(b)`, `compareTo` | `a === b`, `localeCompare` | `a == b`, `a < b` |
| Empty/blank | `s == ""` | `s.isEmpty()`, `s.isBlank()` | `s === ""` | `not s` |

Gotchas in the table:

- Java `split` takes a **regular expression**. `"a.b".split(".")` returns an empty array. Use `Pattern.quote` or `split("\\.")`.
- Java `replace` replaces all occurrences (literal); `replaceAll` takes a regex. JS `replace` with a string only replaces the **first** match; `replaceAll` replaces all.
- Python `join` is a method on the **separator**, not the list.
- Python substring slices past the end never raise; `s[10]` out of range does.

## Slicing

```go
s := "hello"
s[1:3]     // "el"  (half-open: start inclusive, end exclusive)
s[:2]      // "he"
s[3:]      // "lo"
```

```python
s = "hello"
s[1:3]     # "el"
s[-2:]     # "lo"   (negative counts from the end)
s[::2]     # "hlo"  (step)
s[::-1]    # "olleh"
```

```js
"hello".slice(-2);      // "lo" (negative ok)
"hello".substring(1, 3) // "el" (no negatives, swaps args if reversed - prefer slice)
```

```java
"hello".substring(1, 3);   // "el"; throws StringIndexOutOfBoundsException if out of range
```

## Iterating characters

```go
for i, r := range "héllo" {   // r is a rune; i is the BYTE offset of the rune
    fmt.Println(i, string(r))
}
for i := 0; i < len(s); i++ { /* s[i] is a byte - breaks on non-ASCII */ }
```

```java
for (char c : s.toCharArray()) { }          // UTF-16 units
s.codePoints().forEach(cp -> { });          // real code points (IntStream)
```

```js
for (const ch of "héllo😀") { }             // iterates by code point
"😀".length;                                 // 2, but [..."😀"].length is 1
```

```python
for ch in "héllo😀":
    print(ch)                                # code points
```

Go's `range` over a string decodes UTF-8 for you. Indexing does not. This is the single most important Go string fact.

## Bytes vs text

| | Go | Java | JavaScript | Python |
| --- | --- | --- | --- | --- |
| Byte sequence | `[]byte` | `byte[]` | `Uint8Array` | `bytes` (immutable), `bytearray` |
| String -> bytes | `[]byte(s)` | `s.getBytes(StandardCharsets.UTF_8)` | `new TextEncoder().encode(s)` | `s.encode("utf-8")` |
| Bytes -> string | `string(b)` | `new String(b, UTF_8)` | `new TextDecoder().decode(b)` | `b.decode("utf-8")` |

Python 3 strictly separates `str` from `bytes` - mixing them is a `TypeError`. Go lets you convert freely (it's a copy). Always name the charset in Java; the default changed to UTF-8 only in Java 18.

## Regular expressions (standard library)

```go
re := regexp.MustCompile(`(\d+)-(\d+)`)       // RE2 syntax: no backreferences or lookahead
m := re.FindStringSubmatch("10-20")           // ["10-20" "10" "20"]
```

```java
Pattern p = Pattern.compile("(\\d+)-(\\d+)");
Matcher m = p.matcher("10-20");
if (m.matches()) { m.group(1); }
```

```js
const m = "10-20".match(/(\d+)-(\d+)/);       // regex literals are built in
const named = "10-20".match(/(?<a>\d+)-(?<b>\d+)/).groups.a;
```

```python
import re
m = re.match(r"(\d+)-(\d+)", "10-20")
m.group(1)
```

Go's regex engine guarantees linear time and so omits backreferences and lookaround. Java, JS and Python support them (and can suffer catastrophic backtracking).

## Quirks and gotchas

- **Go**: converting an `int` to `string` (`string(65)`) gives `"A"`, not `"65"` - `go vet` warns. Use `strconv.Itoa`.
- **Java**: string `switch` and `.equals` work; `==` compares references. String literals are interned so `==` sometimes "works" in tests and then fails in production.
- **JavaScript**: `"abc"[0]` works, but strings are immutable so `s[0] = "x"` silently does nothing (throws in strict mode).
- **Python**: strings are sequences, so `list("abc")` is `['a', 'b', 'c']` and `"ab" * 3` repeats. `str(b"hi")` gives `"b'hi'"`, not `"hi"` - use `.decode()`.

## What is idiomatic

- **Go**: `strings.Builder` for assembly, `fmt.Sprintf` for formatting, `range` for characters, `%q` to print strings in logs.
- **Java**: `StringBuilder`, text blocks for multi-line, `String.join`, `equals`/`equalsIgnoreCase`.
- **JavaScript**: template literals everywhere, `slice` over `substring`, `.at(-1)` for the last character.
- **Python**: f-strings, `"".join()`, `in` for containment, slicing instead of helper methods.

## Checklist

- [ ] I know what `len` / `length` actually counts in each language
- [ ] I can format a string with values in each language
- [ ] I can split, join, trim, search and replace in each language
- [ ] I know why strings should be built with a builder/join in loops
- [ ] I can iterate by character correctly with non-ASCII text
- [ ] I know how to convert strings to bytes and back
- [ ] I know which regex flavours support lookahead and which do not

## Exercises

In each language, write a function `wordFrequencies(text)` that:

1. Lowercases the text and splits it on whitespace and punctuation.
2. Counts each word (use a map/dictionary - chapter 6 covers them; a simple version is fine for now).
3. Prints the top 3 words with their counts.

Then write a second function `isPalindrome(s)` that ignores case and non-letters and is correct for `"Été"` (non-ASCII input). Compare how much work Go requires for this versus Python.

Stretch: print the byte length and character count of `"héllo😀"` in all four languages and explain each number.
