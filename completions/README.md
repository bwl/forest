# Forest Shell Completions

Tab completion support for the forest CLI.

## Bash

Add to your `~/.bashrc` or `~/.bash_profile`:

```bash
source /path/to/forest/completions/forest.bash
```

Or for a one-time session:

```bash
source completions/forest.bash
```

## Zsh

Add the completions directory to your `fpath` in `~/.zshrc`:

```zsh
fpath=(/path/to/forest/completions $fpath)
autoload -Uz compinit && compinit
```

Or copy `forest.zsh` to one of your existing completion directories:

```bash
cp completions/forest.zsh /usr/local/share/zsh/site-functions/_forest
```

## Features

- Command and subcommand completion
- Recency reference completion (`@`, `@1`, `@2`, etc.)
- Flag completion (`--help`, `--json`, `--tldr`, etc.)
- Contextual suggestions based on command

## Examples

```bash
forest <TAB>         # Shows all commands
forest node <TAB>    # Shows node subcommands
forest node read @<TAB>  # Suggests @, @1, @2, etc.
forest --<TAB>       # Shows available flags
```
