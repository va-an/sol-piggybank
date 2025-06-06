use anchor_lang::prelude::*;

declare_id!("FVhHDx4ctUU8L3UQAmviKe6EQaj3cbtbJcUWxS5Epvt5");

#[program]
pub mod sol_piggybank {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
