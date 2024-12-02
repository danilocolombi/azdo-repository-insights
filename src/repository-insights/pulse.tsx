import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";

import {
  GitCommitRef,
  GitPullRequest,
  GitPullRequestSearchCriteria,
  GitQueryCommitsCriteria,
  GitRepository,
  GitVersionDescriptor,
  GitVersionOptions,
  GitVersionType,
  PullRequestStatus,
} from "azure-devops-extension-api/Git/Git";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { Page } from "azure-devops-ui/Page";
import {
  CustomHeader,
  Header,
  HeaderDescription,
  HeaderTitle,
  HeaderTitleArea,
  HeaderTitleRow,
  TitleSize,
} from "azure-devops-ui/Header";
import { Duration } from "azure-devops-ui/Duration";
import {
  HeaderCommandBar,
  IHeaderCommandBarItem,
} from "azure-devops-ui/HeaderCommandBar";
import { Card } from "azure-devops-ui/Card";
import { Icon } from "azure-devops-ui/Icon";
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  IListItemDetails,
  ListItem,
  ScrollableList,
} from "azure-devops-ui/List";
import { Link } from "azure-devops-ui/Link";
import { Ago } from "azure-devops-ui/Ago";
import { AgoFormat } from "azure-devops-ui/Utilities/Date";
import { getClient } from "azure-devops-extension-api";
import { GitRestClient } from "azure-devops-extension-api/Git/GitClient";
import {
  formatBranchFriendlyName,
  getOneMonthAgo,
  getOneWeekAgo,
  getOneYearAgo,
  isValidDate,
} from "../utils";

interface PulseState {
  pullRequests: GitPullRequest[];
  commits: GitCommitRef[];
  fromDate: Date;
}

interface PulseProps {
  repo: GitRepository;
}

interface ChangeCounts {
  [key: number]: number;
}

interface CommitStats {
  additions: number;
  changes: number;
  deletions: number;
}

export class Pulse extends React.Component<PulseProps, PulseState> {
  constructor(props: PulseProps) {
    super(props);
  }

  public componentDidMount() {
    try {
      SDK.init();

      SDK.ready()
        .then(() => {
          this.loadRepositoryData(getOneMonthAgo());
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
      return <div></div>;
    }

    const { pullRequests, commits, fromDate } = this.state;

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

    const { repo } = this.props;

    const branchFriendlyName = repo.defaultBranch.substring(
      repo.defaultBranch.lastIndexOf("/") + 1
    );

    const content = `${commitsByAuthor.size} author(s) have pushed ${commits.length} commit(s) to ${branchFriendlyName}.
    On ${branchFriendlyName}, ${commitStats.changes} files have changed and there have been 
    ${commitStats.additions} file addition(s) and ${commitStats.deletions} file deletion(s).`;

    let commitsBarData: { name: string; commits: number }[] = [];
    commitsByAuthor.forEach((commits, name) => {
      commitsBarData.push({ name, commits });
    });

    commitsBarData.sort((a, b) => b.commits - a.commits);

    const mergedPRs = new ArrayItemProvider(
      pullRequests.filter((pr) => pr.status === PullRequestStatus.Completed)
    );
    const openPRs = new ArrayItemProvider(
      pullRequests.filter((pr) => pr.status === PullRequestStatus.Active)
    );

    const mergedPullRequestsCount = pullRequests.filter(
      (pr) => pr.status === PullRequestStatus.Completed
    ).length;
    const openPullRequestsCount = pullRequests.filter(
      (pr) => pr.status === PullRequestStatus.Active
    ).length;

    const activePullRequestsCount =
      mergedPullRequestsCount + openPullRequestsCount;

    const prStats = [
      {
        label: "Active pull requests",
        value: activePullRequestsCount,
        icon: "OpenSource",
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

    return (
      <Page className="sample-page width-100">
        <CustomHeader className="bolt-header-with-commandbar">
          <HeaderTitleArea>
            <HeaderTitleRow>
              <HeaderTitle
                ariaLevel={3}
                className="text-ellipsis"
                titleSize={TitleSize.Large}
              >
                Pulse
              </HeaderTitle>
            </HeaderTitleRow>
            <HeaderDescription>
              <Duration startDate={fromDate} />;
            </HeaderDescription>
          </HeaderTitleArea>
          <HeaderCommandBar items={this.commandBarItemsAdvanced} />
        </CustomHeader>
        <div className="bolt-page-content padding-16">
          <Card
            className="flex-grow padding-16"
            titleProps={{ text: "Overview", ariaLevel: 3 }}
          >
            <div className="flex-row" style={{ flexWrap: "wrap" }}>
              {prStats.map((items, index) => (
                <div
                  className="flex-column"
                  style={{ minWidth: "160px", paddingBottom: "5px" }}
                  key={index}
                >
                  <div className="body-m secondary-text">{items.label}</div>
                  <div className="body-m primary-text">
                    <Icon className="icon" iconName={items.icon} />
                    {items.value}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div className="flex-row flex-grow padding-16 text-center">
            <div className="body-xl primary-text">{content}</div>
          </div>
          <div className="flex-row flex-grow padding-16">
            <Card className="flex-grow">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={commitsBarData}>
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
                  <XAxis dataKey="name" padding={{ left: 10, right: 10 }} />
                  <YAxis />
                  <Legend />
                  <Tooltip shared={false} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
          <div className="padding-16">
            <Header
              title={"Pull Requests Merged"}
              titleSize={TitleSize.Medium}
              titleIconProps={{ iconName: "BranchMerge" }}
              titleAriaLevel={3}
            />
            <Card>
              <div style={{ display: "flex", height: "100%" }}>
                <ScrollableList
                  itemProvider={mergedPRs}
                  renderRow={this.renderRow}
                  width="100%"
                />
              </div>
            </Card>
          </div>
          <div className="padding-16">
            <Header
              title={"Open Pull Requests"}
              titleSize={TitleSize.Medium}
              titleIconProps={{ iconName: "BranchCompare" }}
              titleAriaLevel={3}
            />
            <Card>
              <div style={{ display: "flex", height: "100%" }}>
                <ScrollableList
                  itemProvider={openPRs}
                  renderRow={this.renderRowOpenPr}
                  width="100%"
                />
              </div>
            </Card>
          </div>
        </div>
      </Page>
    );
  }

  private async loadRepositoryData(newFromDate: Date): Promise<void> {
    try {
      if (this.state !== null) {
        const { fromDate } = this.state;

        if (isValidDate(fromDate) && fromDate === newFromDate) {
          SDK.notifyLoadSucceeded();
          return;
        }
      }

      const searchCriteria = {
        status: PullRequestStatus.All,
        minTime: newFromDate,
      } as GitPullRequestSearchCriteria;

      const gitClient = getClient(GitRestClient);

      const { repo } = this.props;

      const prs = await gitClient.getPullRequests(repo.id, searchCriteria);

      console.log(prs);

      const itemVersion: GitVersionDescriptor = {
        versionType: GitVersionType.Branch,
        version: formatBranchFriendlyName(repo.defaultBranch),
        versionOptions: GitVersionOptions.None,
      };

      const gitCommitSearchCriteria = {
        fromDate: newFromDate,
        $top: 1000,
        itemVersion: itemVersion,
      } as unknown as GitQueryCommitsCriteria;

      const commits = await gitClient.getCommits(
        repo.id,
        gitCommitSearchCriteria
      );

      this.setState({
        pullRequests: prs,
        commits,
        fromDate: newFromDate,
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
            <Link
              href={this.createPullRequestUrl(item)}
              subtle={true}
              target="_blank"
            >
              {item.title}
            </Link>
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
            <Link
              href={this.createPullRequestUrl(item)}
              subtle={true}
              target="_blank"
            >
              {item.title}
            </Link>
            <span className="fontSizeMS font-size-ms secondary-text wrap-text">
              <Ago date={item.creationDate} format={AgoFormat.Compact} />
            </span>
          </div>
        </div>
      </ListItem>
    );
  };

  private createPullRequestUrl = (item: GitPullRequest): string => {
    const { repo } = this.props;

    return `${repo?.webUrl}/pullrequest/${item.pullRequestId}`;
  };

  private commandBarItemsAdvanced: IHeaderCommandBarItem[] = [
    {
      id: "1week",
      important: false,
      onActivate: () => {
        this.loadRepositoryData(getOneWeekAgo());
      },
      text: "1 week",
    },
    {
      id: "1month",
      important: false,
      onActivate: () => {
        this.loadRepositoryData(getOneMonthAgo());
      },
      text: "1 month",
    },
    {
      id: "1year",
      important: false,
      onActivate: () => {
        this.loadRepositoryData(getOneYearAgo());
      },
      text: "1 year",
    },
  ];
}
