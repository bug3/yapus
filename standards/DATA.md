---
paths:
  - "**/*.json"
  - "**/*.yml"
  - "**/*.yaml"
  - "**/*.toml"
---

# Data

## DATA-1. Use JSON for data a program reads; use another format only where the tool that reads the file requires it.

## DATA-3. Change a file a tool generates, such as a lockfile, only by running that tool.

## DATA-4. Write every string value in a YAML file in double quotes; leave unquoted only keys, `true`, `false` and a number meant as a number.

## DATA-5. Write every TOML file so a TOML 1.0.0 parser reads it: keep each inline table on one line with no trailing comma, and use no `\e`, no `\xHH` and no time without seconds.

## DATA-6. Write a value meant as text in quotes in a TOML file even when it reads as a number or a date, such as `version = "3.10"`.

## DATA-7. Write a TOML string that holds a backslash, such as a regex or a Windows path, as a literal string in single quotes.
