---
paths:
  - "tests/repository/**"
  - "package.json"
  - "pyproject.toml"
  - "go.mod"
---

# Repository

## REPO-1. Before choosing a language, framework or platform, write the constraints it must meet: where it runs, what load it carries, who maintains it.

## REPO-2. Choose a technology whose failure modes others have already written down.

## REPO-3. Use a language whose types can make an illegal state unrepresentable and whose compiler or linter checks a closed set for exhaustiveness.

## REPO-4. Add a dependency, direct or transitive, only for work you would not write and maintain yourself.

## REPO-5. Split a folder when its files form more than one group that changes together, and give each group a subfolder of its own.

## REPO-6. In a folder with subfolders, leave at the top only its entry file, the file that wires its subfolders together, the files more than one subfolder uses, the files a tool requires there and the file a reader opens first.

## REPO-7. Keep a collection, files of one kind with one file per case, flat in one folder, and name its files so that related cases sort together.
