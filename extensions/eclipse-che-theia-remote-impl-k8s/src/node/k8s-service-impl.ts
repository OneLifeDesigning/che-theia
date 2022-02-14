/**********************************************************************
 * Copyright (c) 2021 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

import * as fs from 'fs-extra';
import * as k8s from '@kubernetes/client-node';
import * as os from 'os';
import * as path from 'path';

import { CheK8SService, K8SRawResponse } from '@eclipse-che/theia-remote-api/lib/common/k8s-service';

import { ApiType } from '@kubernetes/client-node';
import { injectable } from 'inversify';

const request = require('request');

@injectable()
export class K8SServiceImpl implements CheK8SService {
  private kc: k8s.KubeConfig;

  constructor() {
    const kubeconfig: k8s.KubeConfig = JSON.parse(
      fs.readFileSync(path.resolve(os.homedir(), '.kube', 'config')).toString()
    );
    const tokenPath = path.resolve(os.homedir(), '.kube', 'token');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const k8sUser: any = kubeconfig.users.find(user => user.name === 'developer');
    if (k8sUser) {
      fs.ensureFileSync(tokenPath);
      fs.writeFileSync(tokenPath, k8sUser.user.token);
    }
    const user = {
      name: 'inClusterUser',
      authProvider: {
        name: 'tokenFile',
        config: {
          tokenFile: tokenPath,
        },
      },
    };
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromCluster();
    this.kc.users = [];
    this.kc.addUser(user);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendRawQuery(requestURL: string, opts: any): Promise<K8SRawResponse> {
    this.kc.applyToRequest(opts);
    const cluster = this.kc.getCurrentCluster();
    if (!cluster) {
      throw new Error('K8S cluster is not defined');
    }
    const URL = `${cluster.server}${requestURL}`;

    return this.makeRequest(URL, opts);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  makeRequest(URL: string, opts: any): Promise<K8SRawResponse> {
    return new Promise((resolve, reject) => {
      request.get(URL, opts, (error: string, response: { statusCode: number }, body: string) => {
        resolve({
          statusCode: response.statusCode,
          data: body,
          error: error,
        });
      });
    });
  }

  getConfig(): k8s.KubeConfig {
    return this.kc;
  }

  makeApiClient<T extends ApiType>(apiClientType: new (server: string) => T): T {
    return this.kc.makeApiClient(apiClientType);
  }
}
