import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";

import "./code-hub-group.scss";
import { Page } from "azure-devops-ui/Page";
import { showRootComponent } from "../../Common";
import {
  TabList,
  TabSize,
  TabProvider,
  IVssContributedTab,
  TabContent,
} from "azure-devops-ui/Tabs";
import {
  ObservableValue,
  ObservableArray,
} from "azure-devops-ui/Core/Observable";
import { Pulse } from "./pulse";
import { Contributors } from "./contributors";
import { Dependencies } from "./dependencies";
import { PipelinesMetrics } from "./pipelines-metrics";
import { GitRepository } from "azure-devops-extension-api/Git/Git";
import {
  GitServiceIds,
  IVersionControlRepositoryService,
} from "azure-devops-extension-api/Git/GitServices";
import { GitRestClient } from "azure-devops-extension-api/Git/GitClient";
import { getClient } from "azure-devops-extension-api";
import { WorkItemsMetrics } from "./work-items-metrics";

interface CodeHubGroupState {
  repo: GitRepository;
}

class CodeHubGroup extends React.Component<{}, CodeHubGroupState> {
  private selectedTabId: ObservableValue<string>;

  constructor(props: {}) {
    super(props);
    this.selectedTabId = new ObservableValue("WorkItemsMetrics");
  }

  public componentDidMount() {
    try {
      SDK.init();

      SDK.ready()
        .then(() => {
          this.loadRepositoryData();
        })
        .catch((error) => {
          console.error("SDK ready failed: ", error);
        });
    } catch (error) {
      console.error(
        "Error during SDK initialization or project context loading: ",
        error
      );
    }
  }

  public render(): JSX.Element {
    if (!this.state) {
      return <div>Loading...</div>;
    }

    const { repo } = this.state;

    const providers = new ObservableArray<IVssContributedTab>();

    providers.push(
      {
        id: "Pulse",
        name: "Pulse",
        render: () => <Pulse repo={repo} />,
      },
      {
        id: "Contributors",
        name: "Contributors",
        render: () => <Contributors repo={repo} />,
      },
      {
        id: "Dependencies",
        name: "Dependencies",
        render: () => (
          <div className="page-content">
            <Dependencies repo={repo} />
          </div>
        ),
      },
      {
        id: "PipelinesMetrics",
        name: "Pipelines Metrics",
        render: () => <PipelinesMetrics repo={repo} />,
      },
      {
        id: "WorkItemsMetrics",
        name: "Work Items Metrics",
        render: () => <WorkItemsMetrics repo={repo} />,
      }
    );

    return (
      <Page className="sample-hub flex-grow">
        <div>
          <div className="flex-row flex-grow">
            <TabProvider
              providers={providers}
              selectedTabId={this.selectedTabId}
            >
              <TabList
                key={1}
                onSelectedTabChanged={this.onSelectedTabChanged}
                selectedTabId={this.selectedTabId}
                tabSize={TabSize.Tall}
                listTitle="Insights"
              ></TabList>
              <TabContent />
            </TabProvider>
          </div>
        </div>
      </Page>
    );
  }

  private onSelectedTabChanged = (newTabId: string) => {
    this.selectedTabId.value = newTabId;
    this.forceUpdate();
  };

  private async loadRepositoryData(): Promise<void> {
    try {
      const repoSvc = await SDK.getService<IVersionControlRepositoryService>(
        GitServiceIds.VersionControlRepositoryService
      );

      const repository = await repoSvc.getCurrentGitRepository();

      if (!repository) {
        return;
      }

      const gitClient = getClient(GitRestClient);
      const repoDetails = await gitClient.getRepository(repository.id);

      this.setState({
        repo: repoDetails,
      });

      SDK.notifyLoadSucceeded();
    } catch (error) {
      console.error("Failed to load project context: ", error);
    }
  }
}

showRootComponent(<CodeHubGroup />);
