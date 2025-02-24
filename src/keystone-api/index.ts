import { GraphQLClient } from 'graphql-request';

export const KEYSTONE_API = process.env.KEYSTONE_API || 'https://web-production-33ab5.up.railway.app/api/graphql';

// Создаем GraphQL клиент
export const client = new GraphQLClient(KEYSTONE_API);