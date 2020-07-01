import { getCustomRepository, getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    // TODO
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);
    // stream que lê nossos arquivos
    const contactsReadStream = fs.createReadStream(filePath);

    // instanciar csvParse
    const parsers = csvParse({
      // no csv parse o primeiro elemento é 1 e não 0, então começamos na linha 2
      from_line: 2,
    });

    // vai lendo as linhas conforme forem disponíveis
    const parseCSV = contactsReadStream.pipe(parsers);

    // variáveis para guardar dados
    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    // leitura do arquivo e desestruturação dos dados
    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      // verificar se as variáveis estão chegando corretamente. Se algum deles
      // não existir, retornamos para não inserir os valores
      if (!title || !type || !value) return;

      // bookinsert - técnica para salvar vários dados no banco de dados com apenas uma conexão
      // adicionamos dados nos arrays
      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    // criamos uma nova promise, pois a leitura de dados não é síncrona
    // verifica se o parseCSV emite um evento END.
    await new Promise(resolve => parseCSV.on('end', resolve));

    // utilizaremos uma nova regra de negócio para inserção dos dados, que é otimizada
    // para salvar dados com apenas uma conexão, ao invés de usar a createTransaction,
    // que salva uma a uma

    // mapear categorias no nosso banco de dados
    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    // para retornar só o title
    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    // retornar só o title de todas as categories que não existiam e filtrar as duplicadas
    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transactionRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionRepository.save(createdTransactions);
    // excluir arquivo
    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
