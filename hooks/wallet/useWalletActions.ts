import { generateReference } from "@/services/utils";
import { supabase } from "@/supabase/client";

export function useWalletActions() {
  // ✅ Fund wallet (DVA)
  const getFundingAccount = async () => {
    const { data, error } = await supabase.functions.invoke("paystack-dva", {
      body: {},
    });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.message ?? "Failed to load account");

    return data.account;
  };

  // ✅ Send money internally (Public UID or Virtual Account Number)
  const sendMoney = async (recipient: string, amount: number) => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error("Invalid amount");
    }

    const reference = generateReference("TRANSFER");

    const cleaned = recipient.trim();
    if (!cleaned) throw new Error("Recipient is required");

    // 10 digits => treat as account number
    const isAccountNumber = /^\d{10}$/.test(cleaned);

    const body = {
      amount: numericAmount,
      reference,
      recipient_public_uid: isAccountNumber ? null : cleaned,
      recipient_account_number: isAccountNumber ? cleaned : null,
    };

    const { data, error } = await supabase.functions.invoke("wallet-transfer", { body });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.message ?? "Transfer failed");

    return data; // { success, reference }
  };

  // ✅ Withdraw to bank
  const withdraw = async (
    amount: number,
    bank_code: string,
    account_number: string,
    account_name?: string
  ) => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error("Invalid amount");
    }

    if (!bank_code?.trim()) throw new Error("Bank code is required");

    const acct = account_number?.trim();
    if (!acct) throw new Error("Account number is required");
    if (!/^\d{10}$/.test(acct)) throw new Error("Account number must be 10 digits");

    const reference = generateReference("WITHDRAW");

    const { data, error } = await supabase.functions.invoke("paystack-withdraw", {
      body: {
        amount: numericAmount,
        bank_code: bank_code.trim(),
        account_number: acct,
        account_name: account_name?.trim() || null,
        reference,
      },
    });

    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.message ?? "Withdrawal failed");

    return data; // { success, reference, status }
  };

  return { getFundingAccount, sendMoney, withdraw };
}


