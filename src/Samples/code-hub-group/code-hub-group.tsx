import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";

import "./code-hub-group.scss";

import { Header, TitleSize } from "azure-devops-ui/Header";
import { Page } from "azure-devops-ui/Page";

import { showRootComponent } from "../../Common";
import { getClient } from "azure-devops-extension-api";
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
import { GitRestClient } from "azure-devops-extension-api/Git/GitClient";
import {
  GitPullRequest,
  GitPullRequestSearchCriteria,
  GitRepository,
  PullRequestStatus,
  GitQueryCommitsCriteria,
  GitCommitRef,
  GitVersionDescriptor,
  GitVersionOptions,
  GitVersionType,
} from "azure-devops-extension-api/Git/Git";
import {
  GitServiceIds,
  IVersionControlRepositoryService,
} from "azure-devops-extension-api/Git/GitServices";
import { Icon } from "azure-devops-ui/Icon";
import { Bar, BarChart, Legend, XAxis, YAxis } from "recharts";
import {
  ScrollableList,
  IListItemDetails,
  ListItem,
} from "azure-devops-ui/List";
import { AgoFormat } from "azure-devops-ui/Utilities/Date";
import { Ago } from "azure-devops-ui/Ago";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";

interface ICodeHubGroup {
  repository: GitRepository | null;
  pullRequests: GitPullRequest[];
  commits: GitCommitRef[];
}

interface ChangeCounts {
  [key: number]: number;
}

interface CommitStats {
  additions: number;
  changes: number;
  deletions: number;
}

class CodeHubGroup extends React.Component<{}, ICodeHubGroup> {
  private selectedTabId: ObservableValue<string>;

  constructor(props: {}) {
    super(props);
    this.selectedTabId = new ObservableValue("Pulse");
    this.state = { repository: null, pullRequests: [], commits: [] };
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
    const { repository, pullRequests, commits } = this.state;

    if (!repository) {
      return <div>Loading...</div>;
    }

    const mergedPullRequestsCount = pullRequests.filter(
      (pr) => pr.status === PullRequestStatus.Completed
    ).length;
    const openPullRequestsCount = pullRequests.filter(
      (pr) => pr.status === PullRequestStatus.Active
    ).length;

    const prStats = [
      {
        label: "Active pull requests",
        value: pullRequests.length,
        icon: "BranchMerge",
      },
      {
        label: "Merged pull requests",
        value: mergedPullRequestsCount,
        icon: "BranchMerge",
      },
      {
        label: "Open pull requests",
        value: openPullRequestsCount,
        icon: "BranchCompare",
      },
    ];

    const commitsByAuthor = new Map<string, number>();
    commits.forEach((commit) => {
      const author = commit.author.email;
      const count = commitsByAuthor.get(author) || 0;
      commitsByAuthor.set(author, count + 1);
    });

    const commitStats: CommitStats = commits.reduce(
      (acc, c) => {
        const changeCounts: ChangeCounts = c.changeCounts as ChangeCounts;
        return {
          additions: acc.additions + (changeCounts[1] ?? 0),
          changes: acc.changes + (changeCounts[2] ?? 0),
          deletions: acc.deletions + (changeCounts[16] ?? 0),
        };
      },
      { additions: 0, changes: 0, deletions: 0 } as CommitStats
    );

    const branchFriendlyName = repository.defaultBranch.substring(
      repository.defaultBranch.lastIndexOf("/") + 1
    );

    const content = `${commitsByAuthor.size} author(s) have pushed ${commits.length} commit(s) to all branches. 
    On ${branchFriendlyName}, ${commitStats.changes} files have changed and there have been 
    ${commitStats.additions} file addition(s) and ${commitStats.deletions} file deletion(s).`;

    let commitsBarData: { name: string; commits: number }[] = [];
    commitsByAuthor.forEach((commits, name) => {
      commitsBarData.push({ name, commits });
    });

    const providers = new ObservableArray<IVssContributedTab>();
    const mergedPRs = new ArrayItemProvider(
      pullRequests.filter((pr) => pr.status === PullRequestStatus.Completed)
    );
    const openPRs = new ArrayItemProvider(
      pullRequests.filter((pr) => pr.status === PullRequestStatus.Active)
    );

    providers.push(
      {
        id: "Pulse",
        name: "Pulse",
        render: () => (
          <div className="page-content">
            <Page className="sample-page">
              <Header title="Pulse" titleSize={TitleSize.Large} />
              <div className="page-content">
                <Card
                  className="flex-grow"
                  titleProps={{ text: "Overview", ariaLevel: 3 }}
                >
                  <div className="flex-row" style={{ flexWrap: "wrap" }}>
                    {prStats.map((items, index) => (
                      <div
                        className="flex-column"
                        style={{ minWidth: "160px", paddingBottom: "5px" }}
                        key={index}
                      >
                        <div className="body-m secondary-text">
                          {items.label}
                        </div>
                        <div className="body-m primary-text">
                          <Icon className="icon" iconName={items.icon} />
                          {items.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                <div className="flex-row" style={{ flexWrap: "wrap" }}>
                  <div
                    className="flex-column padding-16"
                    style={{ width: "50%", justifyContent: "center" }}
                  >
                    <div className="body-xl primary-text">{content}</div>
                  </div>
                  <div className="flex-column padding-16">
                    <div className="body-m secondary-text text-center">
                      <BarChart width={600} height={320} data={commitsBarData}>
                        <Bar
                          dataKey="commits"
                          fill="#8884d8"
                          margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 5,
                          }}
                          barSize={20}
                        ></Bar>
                        <XAxis
                          dataKey="name"
                          padding={{ left: 10, right: 10 }}
                        />
                        <YAxis />
                        <Legend />
                      </BarChart>
                    </div>
                  </div>
                </div>
                <Header
                  title={"Pull Requests Merged"}
                  titleSize={TitleSize.Medium}
                  titleIconProps={{ iconName: "OpenSource" }}
                  titleAriaLevel={3}
                />
                <Card>
                  <div style={{ display: "flex", height: "300px" }}>
                    <ScrollableList
                      itemProvider={mergedPRs}
                      renderRow={this.renderRow}
                      width="100%"
                    />
                  </div>
                </Card>
                <Header
                  title={"Open Pull Requests"}
                  titleSize={TitleSize.Medium}
                  titleIconProps={{ iconName: "BranchCompare" }}
                  titleAriaLevel={3}
                />
                <Card>
                  <div style={{ display: "flex", height: "300px" }}>
                    <ScrollableList
                      itemProvider={openPRs}
                      renderRow={this.renderRowOpenPr}
                      width="100%"
                    />
                  </div>
                </Card>
              </div>
            </Page>
          </div>
        ),
      },
      {
        id: "2",
        name: "Contributors",
        render: () => (
          <div className="page-content">Here you can see the contributors</div>
        ),
      },
      {
        id: "3",
        name: "Community Standards",
        render: () => (
          <div className="page-content">
            Here you can see the community standards
          </div>
        ),
      },
      {
        id: "4",
        name: "Commits",
        render: () => (
          <div className="page-content">Here you can see the commits</div>
        ),
      },
      {
        id: "5",
        name: "Code Frequency",
        render: () => (
          <div className="page-content">
            Here you can see the code frequency
          </div>
        ),
      },
      {
        id: "6",
        name: "Dependency Graph",
        render: () => (
          <div className="page-content">
            Here you can see the dependency graph
          </div>
        ),
      },
      {
        id: "7",
        name: "Network",
        render: () => (
          <div className="page-content">Here you can see the network</div>
        ),
      },
      {
        id: "8",
        name: "Forks",
        render: () => (
          <div className="page-content">Here you can see the forks</div>
        ),
      },
      {
        id: "9",
        name: "Actions Metrics",
        render: () => (
          <div className="page-content">
            Here you can see the actions metrics
          </div>
        ),
      }
    );

    return (
      <Page className="sample-hub flex-grow">
        <div>
          <div className="flex-row flex-grow" style={{ height: 1200 }}>
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

      const oneWeekAgo = new Date();
      // oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      oneWeekAgo.setFullYear(oneWeekAgo.getFullYear() - 10);

      const searchCriteria = {
        status: PullRequestStatus.All,
        minTime: oneWeekAgo,
      } as GitPullRequestSearchCriteria;

      const gitClient = getClient(GitRestClient);

      const prs = await gitClient.getPullRequests(
        repository.id,
        searchCriteria
      );

      const repoDetails = await gitClient.getRepository(repository.id);

      const itemVersion: GitVersionDescriptor = {
        versionType: GitVersionType.Branch,
        version: repository.defaultBranch,
        versionOptions: GitVersionOptions.None,
      };

      const gitCommitSearchCriteria = {
        fromDate: oneWeekAgo,
        itemVersion: itemVersion,
      } as unknown as GitQueryCommitsCriteria;

      const commits = await gitClient.getCommits(
        repository.id,
        gitCommitSearchCriteria
      );

      this.setState({
        repository: repoDetails,
        pullRequests: prs,
        commits,
      });

      SDK.notifyLoadSucceeded();
    } catch (error) {
      console.error("Failed to load project context: ", error);
    }
  }

  private renderRow = (
    index: number,
    item: GitPullRequest,
    details: IListItemDetails<GitPullRequest>,
    key?: string
  ): JSX.Element => {
    return (
      <ListItem
        key={key || "list-item" + index}
        index={index}
        details={details}
      >
        <div className="list-example-row flex-row h-scroll-hidden">
          <div
            style={{ marginLeft: "10px", padding: "10px 0px" }}
            className="flex-column h-scroll-hidden"
          >
            <span className="wrap-text">{item.title}</span>
            <span className="fontSizeMS font-size-ms secondary-text wrap-text">
              <Ago date={item.closedDate} format={AgoFormat.Compact} />
            </span>
          </div>
        </div>
      </ListItem>
    );
  };

  private renderRowOpenPr = (
    index: number,
    item: GitPullRequest,
    details: IListItemDetails<GitPullRequest>,
    key?: string
  ): JSX.Element => {
    return (
      <ListItem
        key={key || "list-item" + index}
        index={index}
        details={details}
      >
        <div className="list-example-row flex-row h-scroll-hidden">
          <div
            style={{ marginLeft: "10px", padding: "10px 0px" }}
            className="flex-column h-scroll-hidden"
          >
            <span className="wrap-text">{item.title}</span>
            <span className="fontSizeMS font-size-ms secondary-text wrap-text">
              <Ago date={item.creationDate} format={AgoFormat.Compact} />
            </span>
          </div>
        </div>
      </ListItem>
    );
  };
}

showRootComponent(<CodeHubGroup />);
