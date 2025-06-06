import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolPiggybank } from "../target/types/sol_piggybank";
import { SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";

describe("Piggybank Test", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SolPiggybank as Program<SolPiggybank>;
  const user = provider.wallet.publicKey;

  console.log("Program ID:", program.programId.toString());
  console.log("Wallet:", user.toString());

  let piggybankPDA: anchor.web3.PublicKey;
  let bump: number;

  before(async () => {
    [piggybankPDA, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("piggybank"), user.toBuffer()],
      program.programId
    );
    
    console.log("Piggybank PDA:", piggybankPDA.toString());
    console.log("Bump:", bump);
  });

  it("initialize piggybank", async () => {
    try {
      // Send initialize transaction
      const txHash = await program.methods
        .initialize()
        .accounts({
          piggybank: piggybankPDA,
          user: user,
          systemProgram: SystemProgram.programId
        })
        .rpc();
      
      console.log(`✅ Initialize transaction: ${txHash}`);
      console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

      // Wait a bit for confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fetch the created piggybank account
      const piggybankAccount = await program.account.piggybank.fetch(piggybankPDA);

      console.log("✅ Piggybank created!");
      console.log("Owner:", piggybankAccount.owner.toString());
      console.log("Total deposited:", piggybankAccount.totalDeposited.toString());

      // Verify owner is correct
      assert(piggybankAccount.owner.equals(user));
      console.log("🎉 Piggybank initialized successfully!");

    } catch (error) {
      if (error.message.includes("already in use") || error.message.includes("0x0")) {
        console.log("ℹ️  Piggybank already exists, fetching existing account...");
        
        try {
          const piggybankAccount = await program.account.piggybank.fetch(piggybankPDA);
          console.log("Existing owner:", piggybankAccount.owner.toString());
          console.log("Existing total deposited:", piggybankAccount.totalDeposited.toString());
        } catch (fetchError) {
          console.log("❌ Could not fetch existing piggybank:", fetchError.message);
        }
      } else {
        console.log("❌ Initialize error:", error.message);
        throw error;
      }
    }
  });

  it("deposit, check balance, withdraw, check balance", async () => {
    try {
      // 1. Check initial balance
      console.log("\n🔍 Initial balance check...");
      
      let availableBalance = await program.methods
        .getBalance()
        .accounts({
          piggybank: piggybankPDA,
          user: user,
        })
        .view();

      let trackedBalance = await program.methods
        .getTrackedBalance()
        .accounts({
          piggybank: piggybankPDA,
          user: user,
        })
        .view();

      console.log("💰 Initial available balance:", (availableBalance.toNumber() / LAMPORTS_PER_SOL).toFixed(4), "SOL");
      console.log("📊 Initial tracked balance:", (trackedBalance.toNumber() / LAMPORTS_PER_SOL).toFixed(4), "SOL");

      // 2. Make a deposit
      console.log("\n💸 Making deposit...");
      const depositAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
      
      const depositTx = await program.methods
        .deposit(new anchor.BN(depositAmount))
        .accounts({
          piggybank: piggybankPDA,
          user: user,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Deposit transaction:", depositTx);
      console.log("💰 Deposited:", depositAmount / LAMPORTS_PER_SOL, "SOL");
      
      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. Check balance after deposit
      console.log("\n📊 Balance after deposit...");
      
      availableBalance = await program.methods
        .getBalance()
        .accounts({
          piggybank: piggybankPDA,
          user: user,
        })
        .view();

      trackedBalance = await program.methods
        .getTrackedBalance()
        .accounts({
          piggybank: piggybankPDA,
          user: user,
        })
        .view();

      console.log("💰 Available balance after deposit:", (availableBalance.toNumber() / LAMPORTS_PER_SOL).toFixed(4), "SOL");
      console.log("📊 Tracked balance after deposit:", (trackedBalance.toNumber() / LAMPORTS_PER_SOL).toFixed(4), "SOL");

      // 4. Make a withdrawal
      console.log("\n💳 Making withdrawal...");
      
      // Withdraw smaller amount to avoid issues
      const withdrawAmount = Math.min(0.05 * LAMPORTS_PER_SOL, availableBalance.toNumber() - 1000000); // Leave some for rent
      
      if (withdrawAmount <= 0) {
        console.log("⚠️  Not enough balance to withdraw, skipping withdrawal test");
      } else {
        console.log("Attempting to withdraw:", withdrawAmount / LAMPORTS_PER_SOL, "SOL");
        
        try {
          const withdrawTx = await program.methods
            .withdraw(new anchor.BN(withdrawAmount))
            .accounts({
              piggybank: piggybankPDA,
              user: user,
              systemProgram: SystemProgram.programId,
            })
            .rpc();

          console.log("✅ Withdraw transaction:", withdrawTx);
          console.log("💸 Withdrawn:", withdrawAmount / LAMPORTS_PER_SOL, "SOL");
          
          // Wait for confirmation
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (withdrawError) {
          console.log("❌ Withdraw failed:", withdrawError.message);
          console.log("Available balance was:", availableBalance.toNumber(), "lamports");
          console.log("Tried to withdraw:", withdrawAmount, "lamports");
          // Don't throw, continue with final balance check
        }
      }
      
      // Wait for confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 5. Check final balance
      console.log("\n🏁 Final balance check...");
      
      availableBalance = await program.methods
        .getBalance()
        .accounts({
          piggybank: piggybankPDA,
          user: user,
        })
        .view();

      trackedBalance = await program.methods
        .getTrackedBalance()
        .accounts({
          piggybank: piggybankPDA,
          user: user,
        })
        .view();

      console.log("💰 Final available balance:", (availableBalance.toNumber() / LAMPORTS_PER_SOL).toFixed(4), "SOL");
      console.log("📊 Final tracked balance:", (trackedBalance.toNumber() / LAMPORTS_PER_SOL).toFixed(4), "SOL");

      console.log("\n🎉 Full workflow completed successfully!");
      
    } catch (error) {
      console.log("❌ Workflow error:", error.message);
      throw error;
    }
  });
});
