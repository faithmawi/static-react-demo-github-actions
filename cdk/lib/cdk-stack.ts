import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as iam from "@aws-cdk/aws-iam";
import * as s3Deployment from "@aws-cdk/aws-s3-deployment";
import * as cloudFront from "@aws-cdk/aws-cloudfront";
import * as origins from "@aws-cdk/aws-cloudfront-origins";

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Hosting Bucket
    const bucket = new s3.Bucket(this, "faithmawi-static-react-app-hosting", {
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // if we destroy this stack we're going to delete the bucket as well
      autoDeleteObjects: true,
    }); // this code takes our build files locally and puts them up in a zip into a deployment bucket, this deployment bucket has a lambda that fires and it puts this zip in the s3 bucket

    // 2. Deployment bucket
    new s3Deployment.BucketDeployment(
      this,
      "faithmawi-static-react-app-deployment",
      {
        destinationBucket: bucket,
        sources: [s3Deployment.Source.asset("../build")],
      }
    );

    const distribution = new cloudFront.Distribution(
      this,
      "faithmawi-static-react-app-distribution",
      {
        defaultBehavior: { origin: new origins.S3Origin(bucket) },
        webAclId: `arn:aws:wafv2:us-east-1:${process.env.AWS_ACCOUNT}:global/webacl/${process.env.WEB_ACL_ID}`,
      }
    );

    //3. Add deployment boundary - which is a boundary for the iam policies - enforces this boundary across all assets - prevents us doing things we're not supposed to - for example creating an iam permissions with more permissions than your own role
    const boundary = iam.ManagedPolicy.fromManagedPolicyArn(
      this,
      "Boundary",
      `arn:aws:iam::${process.env.AWS_ACCOUNT}:policy/ScopePermissions`
    );
    iam.PermissionsBoundary.of(this).apply(boundary);

    // 4. Outputs

    new cdk.CfnOutput(this, "Bucket URL", {
      value: bucket.bucketDomainName,
    });

    new cdk.CfnOutput(this, "CloudFront URL", {
      value: distribution.distributionDomainName,
    });
  }
}
