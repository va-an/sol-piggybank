# Sol Piggybank

Simple Solana smart contract for depositing, tracking, and withdrawing SOL.

## Features

- Initialize personal piggybank account
- Deposit SOL
- Check available/tracked balance  
- Withdraw SOL

## Quick Start

```bash
# Setup devnet
solana config set --url https://api.devnet.solana.com
solana airdrop 2

# Build & deploy
anchor build
anchor deploy --provider.cluster devnet

# Test
anchor test --skip-deploy --provider.cluster devnet
```

## Functions

- `initialize()` - create piggybank
- `deposit(amount)` - deposit SOL
- `withdraw(amount)` - withdraw SOL
- `get_balance()` - check available balance
- `get_tracked_balance()` - check tracked balance

## Program ID
```
FVhHDx4ctUU8L3UQAmviKe6EQaj3cbtbJcUWxS5Epvt5
```

