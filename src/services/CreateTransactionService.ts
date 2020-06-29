// import AppError from '../errors/AppError';
import { getCustomRepository } from 'typeorm';

import TransactionsRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';

interface RequestDTO {
  title: string;
  value: number;
  type: 'income' | 'outcome';
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
  }: RequestDTO): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const transactions = await transactionsRepository.find();

    if (!['income', 'outcome'].includes(type)) {
      throw new Error('Transaction type is invalid');
    }

    const { total } = transactionsRepository.getBalance(transactions);

    if (type === 'outcome' && total - value < 0) {
      throw new Error('Insufficient funds..');
    }

    const newTransaction = transactionsRepository.create({
      title,
      type,
      value,
    });

    return newTransaction;
  }
}

export default CreateTransactionService;
