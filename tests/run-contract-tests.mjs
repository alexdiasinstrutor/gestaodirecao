import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@supabase/supabase-js') {
      const chainCode = `
        function makeChain() {
          const chain = {
            select: () => chain,
            eq: () => chain,
            in: () => chain,
            order: () => chain,
            limit: async () => ({ data: [], error: null }),
            then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve)
          };
          return chain;
        }
        export function createClient() {
          return {
            auth: {
              getSession: async () => ({ data: { session: null } }),
              onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
            },
            from: () => ({
              select: () => makeChain(),
              upsert: async () => ({ error: null }),
              delete: () => makeChain()
            }),
            rpc: async () => ({ data: null, error: { message: 'no-session' } })
          };
        }
      `;
      return {
        shortCircuit: true,
        url: 'data:text/javascript,' + encodeURIComponent(chainCode)
      };
    }
    return nextResolve(specifier, context);
  }
});

await import('./contract-flow.test.ts');
