import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

interface CreateTransactionDTO {
  title: string;
  value: number;
  type: 'income' | 'outcome';
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public getBalance(transactions: Transaction[]): Balance {
    const balance: Balance = transactions.reduce(
      (accum, obj) => {
        const b = accum;

        b[obj.type] += obj.value;

        return b;
      },
      {
        income: 0,
        outcome: 0,
        total: 0,
      },
    );

    balance.total = balance.income - balance.outcome;

    return balance;
  }
}

export default TransactionsRepository;
