import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';

const baseHandler = async (event: any) => {
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};

export const handler = middy(baseHandler).use(httpJsonBodyParser());
