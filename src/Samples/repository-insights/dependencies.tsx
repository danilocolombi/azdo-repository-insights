import * as SDK from "azure-devops-extension-sdk";
import React from "react";

import { Card } from "azure-devops-ui/Card";
import {
  IListItemDetails,
  ListItem,
  ListSelection,
  ScrollableList,
} from "azure-devops-ui/List";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { getClient } from "azure-devops-extension-api";
import { GitRestClient } from "azure-devops-extension-api/Git/GitClient";
import {
  GitItem,
  GitRepository,
  VersionControlRecursionType,
} from "azure-devops-extension-api/Git/Git";
import { Page } from "azure-devops-ui/Page";
import {
  CustomHeader,
  HeaderDescription,
  HeaderTitle,
  HeaderTitleArea,
  HeaderTitleRow,
  TitleSize,
} from "azure-devops-ui/Header";

interface DependenciesState {
  dependencies: string[];
}

interface DependenciesProps {
  repo: GitRepository;
}

export class Dependencies extends React.Component<
  DependenciesProps,
  DependenciesState
> {
  private selection = new ListSelection(true);

  constructor(props: DependenciesProps) {
    super(props);
  }

  public componentDidMount() {
    try {
      SDK.init();

      SDK.ready()
        .then(() => {
          this.loadItems();
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

    const { dependencies } = this.state;

    const projectDeps = new ArrayItemProvider(
      dependencies.sort((a, b) => a.localeCompare(b))
    );

    const depsCard =
      dependencies.length == 0 ? (
        <Card className="flex-grow">
          <div style={{ display: "flex", height: "100%" }}>
            <div className="flex-column h-scroll-hidden">
              <span className="wrap-text">
                No dependencies found. The supported repositories types are:
                .NET, Node, Go, Maven
              </span>
            </div>
          </div>
        </Card>
      ) : (
        <Card
          className="flex-grow"
          titleProps={{ text: `Dependencies (${dependencies.length})` }}
        >
          <div style={{ display: "flex", height: "100%" }}>
            <ScrollableList
              itemProvider={projectDeps}
              renderRow={this.renderRow}
              selection={this.selection}
              width="100%"
            />
          </div>
        </Card>
      );

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
                Dependencies
              </HeaderTitle>
            </HeaderTitleRow>
            <HeaderDescription>
              Dependencies used in the project
            </HeaderDescription>
          </HeaderTitleArea>
        </CustomHeader>

        <div className="bolt-page-content">
          <div className="flex-row flex-grow justify-content-center padding-16 text-center">
            {depsCard}
          </div>
        </div>
      </Page>
    );
  }

  private renderRow = (
    index: number,
    item: string,
    details: IListItemDetails<string>,
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
            style={{ marginLeft: "10px", padding: "20px 0px" }}
            className="flex-column h-scroll-hidden"
          >
            <span className="wrap-text">{item}</span>
          </div>
        </div>
      </ListItem>
    );
  };

  private async loadItems(): Promise<void> {
    try {
      const { repo } = this.props;
      const versionControlRecursion = VersionControlRecursionType.Full;

      const items = await getClient(GitRestClient).getItems(
        repo.id,
        undefined,
        undefined,
        versionControlRecursion
      );

      let dependencies = await this.retrieveDependenciesFromDotNet(
        repo.id,
        items
      );

      dependencies = dependencies.concat(
        await this.retrieveDependenciesFromNode(repo.id, items)
      );

      dependencies = dependencies.concat(
        await this.retrieveDependenciesFromGo(repo.id, items)
      );

      dependencies = dependencies.concat(
        await this.retrieveDependenciesFromMaven(repo.id, items)
      );

      this.setState({ dependencies: Array.from(dependencies) });

      SDK.notifyLoadSucceeded();
    } catch (error) {
      console.error("Failed to load project context: ", error);
    }
  }

  private async retrieveDependenciesFromDotNet(
    repositoryId: string,
    items: GitItem[]
  ): Promise<string[]> {
    const dependencies: Set<string> = new Set();

    const csprojItems = items.filter((item) => item.path.endsWith(".csproj"));

    if (csprojItems.length === 0) {
      return [];
    }

    for (const item of csprojItems) {
      const content = await getClient(GitRestClient).getItemContent(
        repositoryId,
        item.path
      );

      const contentString = new TextDecoder("utf-8").decode(content);
      const xml = new DOMParser().parseFromString(contentString, "text/xml");

      const packageReferences = xml.getElementsByTagName("PackageReference");

      for (let i = 0; i < packageReferences.length; i++) {
        const packageReference = packageReferences[i];
        const name = packageReference.getAttribute("Include");
        const version = packageReference.getAttribute("Version");

        if (!name || !version) {
          continue;
        }

        const dependency = `${name}@${version}`;

        if (dependencies.has(dependency)) {
          continue;
        }

        dependencies.add(dependency);
      }
    }

    return Array.from(dependencies);
  }

  private async retrieveDependenciesFromNode(
    repositoryId: string,
    items: GitItem[]
  ): Promise<string[]> {
    const dependencies: Set<string> = new Set();

    const packageJsonItems = items.filter((item) =>
      item.path.endsWith("package.json")
    );

    if (packageJsonItems.length === 0) {
      return [];
    }

    for (const item of packageJsonItems) {
      const content = await getClient(GitRestClient).getItemContent(
        repositoryId,
        item.path
      );

      const contentString = new TextDecoder("utf-8").decode(content);
      const json = JSON.parse(contentString);

      if (!json.dependencies) {
        continue;
      }

      for (const dependency in json.dependencies) {
        const version = json.dependencies[dependency];

        if (!version) {
          continue;
        }

        const dependencyWithVersion = `${dependency}@${version}`;

        if (dependencies.has(dependencyWithVersion)) {
          continue;
        }

        dependencies.add(dependencyWithVersion);
      }
    }

    return Array.from(dependencies);
  }

  private async retrieveDependenciesFromGo(
    repositoryId: string,
    items: GitItem[]
  ): Promise<string[]> {
    const dependencies: Set<string> = new Set();

    const goModItems = items.filter((item) => item.path.endsWith("go.mod"));

    if (goModItems.length === 0) {
      return [];
    }

    for (const item of goModItems) {
      const content = await getClient(GitRestClient).getItemContent(
        repositoryId,
        item.path
      );

      const contentString = new TextDecoder("utf-8").decode(content);
      const lines = contentString.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith("require")) {
          continue;
        }

        let dependencyLine = true;

        while (dependencyLine) {
          i++;

          if (i >= lines.length) {
            break;
          }

          if (lines[i].startsWith(")")) {
            dependencyLine = false;
            continue;
          }

          console.log(lines[i]);

          const dependency = lines[i].replace(" ", "@");

          if (dependencies.has(dependency)) {
            continue;
          }

          dependencies.add(dependency);
        }
      }
    }

    return Array.from(dependencies);
  }

  private async retrieveDependenciesFromMaven(
    repositoryId: string,
    items: GitItem[]
  ): Promise<string[]> {
    const dependencies: Set<string> = new Set();

    const pomXmlItems = items.filter((item) => item.path.endsWith("pom.xml"));

    if (pomXmlItems.length === 0) {
      return [];
    }

    for (const item of pomXmlItems) {
      const content = await getClient(GitRestClient).getItemContent(
        repositoryId,
        item.path
      );

      const contentString = new TextDecoder("utf-8").decode(content);
      const xml = new DOMParser().parseFromString(contentString, "text/xml");

      const dependenciesXml = xml.getElementsByTagName("dependencies");

      if (dependenciesXml.length === 0) {
        continue;
      }

      const dependencyXml =
        dependenciesXml[0].getElementsByTagName("dependency");

      for (let i = 0; i < dependencyXml.length; i++) {
        const dependency = dependencyXml[i];

        const groupIdElement = dependency.getElementsByTagName("groupId")[0];
        const artifactIdElement =
          dependency.getElementsByTagName("artifactId")[0];
        const groupId = groupIdElement ? groupIdElement.textContent : null;
        const artifactId = artifactIdElement
          ? artifactIdElement.textContent
          : null;

        if (!groupId || !artifactId) {
          continue;
        }

        const dependencyWithVersion = `${groupId}:${artifactId}`;

        if (dependencies.has(dependencyWithVersion)) {
          continue;
        }

        dependencies.add(dependencyWithVersion);
      }
    }

    return Array.from(dependencies);
  }
}
