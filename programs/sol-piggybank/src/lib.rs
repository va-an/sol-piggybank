use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("FVhHDx4ctUU8L3UQAmviKe6EQaj3cbtbJcUWxS5Epvt5");

#[program]
pub mod sol_piggybank {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let piggybank = &mut ctx.accounts.piggybank;
        piggybank.owner = ctx.accounts.user.key();
        piggybank.total_deposited = 0;

        emit!(Initialized {
            user: piggybank.owner,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Piggybank initialized for user: {}", piggybank.owner);
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, PiggybankError::InvalidAmount);

        let transfer_instruction = system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.piggybank.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
        );

        system_program::transfer(cpi_ctx, amount)?;

        let piggybank = &mut ctx.accounts.piggybank;
        piggybank.total_deposited = piggybank
            .total_deposited
            .checked_add(amount)
            .ok_or(PiggybankError::MathOverflow)?;

        emit!(Deposited {
            user: piggybank.owner,
            amount,
            total_deposited: piggybank.total_deposited,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Deposited {} lamports. Total: {}",
            amount,
            piggybank.total_deposited
        );
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, PiggybankError::InvalidAmount);

        let actual_balance = ctx.accounts.piggybank.to_account_info().lamports();
        let rent_exempt_minimum = Rent::get()?.minimum_balance(Piggybank::SPACE);
        let available_balance = actual_balance.saturating_sub(rent_exempt_minimum);

        require!(
            available_balance >= amount,
            PiggybankError::InsufficientFunds
        );

        **ctx
            .accounts
            .piggybank
            .to_account_info()
            .try_borrow_mut_lamports()? -= amount;

        **ctx
            .accounts
            .user
            .to_account_info()
            .try_borrow_mut_lamports()? += amount;

        let piggybank = &mut ctx.accounts.piggybank;
        piggybank.total_deposited = piggybank
            .total_deposited
            .checked_sub(amount)
            .ok_or(PiggybankError::MathOverflow)?;

        emit!(Withdrawn {
            user: piggybank.owner,
            amount,
            remaining: piggybank.total_deposited,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "Withdrawn {} lamports. Remaining: {}",
            amount,
            piggybank.total_deposited
        );
        Ok(())
    }

    pub fn get_balance(ctx: Context<GetBalance>) -> Result<u64> {
        let actual_balance = ctx.accounts.piggybank.to_account_info().lamports();
        let rent_exempt_minimum = Rent::get()?.minimum_balance(Piggybank::SPACE);
        let available_balance = actual_balance.saturating_sub(rent_exempt_minimum);

        msg!("Current available balance: {} lamports", available_balance);
        Ok(available_balance)
    }

    pub fn get_tracked_balance(ctx: Context<GetBalance>) -> Result<u64> {
        let piggybank = &ctx.accounts.piggybank;
        msg!(
            "Tracked deposited balance: {} lamports",
            piggybank.total_deposited
        );
        Ok(piggybank.total_deposited)
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = Piggybank::SPACE,
        seeds = [b"piggybank", user.key().as_ref()],
        bump
    )]
    pub piggybank: Account<'info, Piggybank>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"piggybank", user.key().as_ref()],
        bump,
        constraint = piggybank.owner == user.key() @ PiggybankError::UnauthorizedAccess
    )]
    pub piggybank: Account<'info, Piggybank>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"piggybank", user.key().as_ref()],
        bump,
        constraint = piggybank.owner == user.key() @ PiggybankError::UnauthorizedAccess
    )]
    pub piggybank: Account<'info, Piggybank>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetBalance<'info> {
    #[account(
        seeds = [b"piggybank", user.key().as_ref()],
        bump,
        constraint = piggybank.owner == user.key() @ PiggybankError::UnauthorizedAccess
    )]
    pub piggybank: Account<'info, Piggybank>,

    pub user: Signer<'info>,
}

#[account]
pub struct Piggybank {
    pub owner: Pubkey,
    pub total_deposited: u64,
}

impl Piggybank {
    pub const SPACE: usize = 8 + 32 + 8;
}

#[event]
pub struct Initialized {
    pub user: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct Deposited {
    pub user: Pubkey,
    pub amount: u64,
    pub total_deposited: u64,
    pub timestamp: i64,
}

#[event]
pub struct Withdrawn {
    pub user: Pubkey,
    pub amount: u64,
    pub remaining: u64,
    pub timestamp: i64,
}

#[error_code]
pub enum PiggybankError {
    #[msg("Invalid amount: must be greater than 0")]
    InvalidAmount,

    #[msg("Insufficient funds for withdrawal")]
    InsufficientFunds,

    #[msg("Unauthorized access to piggybank")]
    UnauthorizedAccess,

    #[msg("Math operation overflow")]
    MathOverflow,
}
