import { JSONRPCClient } from 'json-rpc-2.0';

const _rpc = new JSONRPCClient((jsonRPCRequest) => {
  window.adsk.fusionSendData('jsonrpc', JSON.stringify(jsonRPCRequest));
});


window.fusionJavaScriptHandler = {
  handle: function (action, data) {
    try {
      if (action == 'jsonrpc') {
        _rpc.receive(JSON.parse(data));
      }

    } catch (e) {
      console.log(e);
      console.log('exception caught with command: ' + action + ', data: ' + data);
    }
    return 'OK';
  }
};

const fusionRpc = {
  request: async (method, params, clientParams) => {
    return _rpc.request(method, params, clientParams);
  }
}


const noRpc = {
  escapeRegExp: (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },
  request: async (method, params, clientParams) => {
    if (method === "kv_set") {
      localStorage.setItem(params.key, JSON.stringify(params.value));
    } else if (method === "kv_get") {
      return JSON.parse(localStorage.getItem(params.key));
    } else if (method === "kv_mset") {
      for (const [key, value] of Object.entries(params.obj)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } else if (method === "kv_mget") {
      return Object.fromEntries(params.keys.map(k => [k, JSON.parse(localStorage.getItem(k))]));
    } else if (method === "kv_del") {
      localStorage.removeItem(params.key);
    } else if (method == "kv_mdel") {
      if (params.keys) {
        params.keys.map(localStorage.removeItem);
      }
      if (params.pattern) {
        const pat = new RegExp(`^${params.pattern.split('%').map(this.escapeRegExp).join('.*')}$`);
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.match(pat)) {
            localStorage.removeItem(key);
          }
        }
      }
    } else if (method === "kv_keys") {
      const results = [];
      let pat = /^.*$/;
      if (params.pattern) {
        pat = new RegExp(`^${params.pattern.split('%').map(this.escapeRegExp).join('.*')}$`);
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.match(pat)) {
          results.push(key);
        }
      }
      return results;
    }
  }
}

const rpc = {
  init: async () => {
    if (window.adsk === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (window.adsk === undefined) {
        rpc.request = noRpc.request;
        console.log("Fusion360 was not found.");
        return;
      }
    }
    console.log("Fusion360 was found.");
    rpc.request = fusionRpc.request;
  }
}

export default rpc;