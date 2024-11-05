import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";

import "./code-hub-group.scss";

import { Header } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";

import { showRootComponent } from "../../Common";
import {
  CommonServiceIds,
  getClient,
  IProjectPageService,
} from "azure-devops-extension-api";
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
import { Card } from "azure-devops-ui/Card";
import { ProjectAnalysisRestClient } from "azure-devops-extension-api/ProjectAnalysis/ProjectAnalysisClient";
import { AggregationType, ProjectLanguageAnalytics } from "azure-devops-extension-api/ProjectAnalysis/ProjectAnalysis";


interface ICodeHubGroup {
  projectContext: any;
}

class CodeHubGroup extends React.Component<{}, ICodeHubGroup> {
  private selectedTabId: ObservableValue<string>;

  constructor(props: {}) {
    super(props);
    this.selectedTabId = new ObservableValue("Overview");
    this.state = { projectContext: undefined };
  }

  public componentDidMount() {
    try {
      console.log("Component did mount, initializing SDK...");
      SDK.init();

      SDK.ready()
        .then(() => {
          console.log("SDK is ready, loading project context...");
          this.loadProjectContext();
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

    return (
      <Page className="sample-hub flex-grow">
        <div>
          <div className="flex-row flex-grow" style={{ height: 1200 }}>
            <TabProvider providers={providers} selectedTabId={this.selectedTabId}>
              <TabList
                key={1}
                onSelectedTabChanged={this.onSelectedTabChanged}
                selectedTabId={this.selectedTabId}
                tabSize={TabSize.Tall}
                listTitle="Insights"
              >
              </TabList>
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

  private async loadProjectContext(): Promise<void> {
    try {
      const client = await SDK.getService<IProjectPageService>(
        CommonServiceIds.ProjectPageService
      );
      const context = await client.getProject();

      if (!context) {
        return;
      }

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);


      const projectLanguageAnalytics = await getClient(
        ProjectAnalysisRestClient
      ).getProjectActivityMetrics(context.name, oneWeekAgo, AggregationType.Daily);

      console.log(projectLanguageAnalytics);
      console.log(context);


      this.setState({ projectContext: context });

      SDK.notifyLoadSucceeded();
    } catch (error) {
      console.error("Failed to load project context: ", error);
    }
  }
}

const providers = new ObservableArray<IVssContributedTab>();
providers.push(
  {
    id: "1",
    name: "Pulse",
    render: () => <div className="page-content">
      <Page className="sample-page">
        <Header
          title="Pulse"
        />
        <div className="page-content">
          <Card className="flex-grow" titleProps={{ text: "Will Orta 2018-2019 🏀", ariaLevel: 3 }}>
            <div className="flex-row" style={{ flexWrap: "wrap" }}>
              {stats.map((items, index) => (
                <div className="flex-column" style={{ minWidth: "120px" }} key={index}>
                  <div className="body-m secondary-text">{items.label}</div>
                  <div className="body-m primary-text">{items.value}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Page></div>
  },
  {
    id: "2",
    name: "Contributors",
    render: () => <div className="page-content">Here you can see the contributors</div>
  },
  {
    id: "3",
    name: "Community Standards",
    render: () => <div className="page-content">Here you can see the community standards</div>
  },
  {
    id: "4",
    name: "Commits",
    render: () => <div className="page-content">Here you can see the commits</div>
  },
  {
    id: "5",
    name: "Code Frequency",
    render: () => <div className="page-content">Here you can see the code frequency</div>
  },
  {
    id: "6",
    name: "Dependency Graph",
    render: () => <div className="page-content">Here you can see the dependency graph</div>
  },
  {
    id: "7",
    name: "Network",
    render: () => <div className="page-content">Here you can see the network</div>
  },
  {
    id: "8",
    name: "Forks",
    render: () => <div className="page-content">Here you can see the forks</div>
  },
  {
    id: "9",
    name: "Actions Metrics",
    render: () => <div className="page-content">Here you can see the actions metrics</div>
  }
);

const stats = [
  {
    label: "Points",
    value: 340
  },
  {
    label: "3PM",
    value: 23
  },
  {
    label: "Rebounds",
    value: 203
  },
  {
    label: "Assists",
    value: 290
  },
  {
    label: "Steals",
    value: 56
  }
];

showRootComponent(<CodeHubGroup />);
