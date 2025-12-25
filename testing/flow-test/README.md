# Flow Test Project

Minimal project for testing flow CLI features.

## Quick Start

```bash
f setup   # Pull env from 1focus, create .env
f dev     # Start dev server
f test    # Run test suite
```

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `f setup` | `f s` | Full setup with 1focus env pull |
| `f dev` | `f d` | Start dev server |
| `f test` | `f t` | Run flow feature tests |
| `f env-pull` | `f env` | Pull env from 1focus |
| `f env-push` | `f envs` | Push local .env to 1focus |
| `f env-show` | `f env1f` | Show env stored in 1focus |
| `f env-local` | `f envl` | Show local .env |

## Testing Flow Features

The `f test` command runs:
1. 1focus API connectivity
2. Env endpoint functionality
3. Local .env existence
4. Env push operation
5. Push verification

All tests should pass for a healthy flow setup.
